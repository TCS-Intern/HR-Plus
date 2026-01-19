"""Phone Screen API endpoints."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks

from app.schemas.phone_screen import (
    PhoneScreenScheduleRequest,
    PhoneScreenResponse,
    PhoneScreenListResponse,
    PhoneScreenWithCandidateResponse,
    VapiWebhookPayload,
)
from app.services.supabase import db
from app.services.vapi import vapi_service

router = APIRouter()


# ============================================
# SCHEDULING & INITIATION
# ============================================


@router.post("/schedule", response_model=dict)
async def schedule_phone_screen(
    request: PhoneScreenScheduleRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Schedule a phone screen for a candidate.

    If scheduled_at is None, initiates the call immediately.
    """
    # Get application with candidate and job data
    application = await db.get_application(request.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if phone screen already exists for this application
    existing = await db.get_phone_screen_by_application(request.application_id)
    if existing and existing.get("status") not in ["cancelled", "failed", "no_answer"]:
        raise HTTPException(
            status_code=400,
            detail=f"Phone screen already exists with status: {existing.get('status')}",
        )

    # Get candidate and job details
    candidate = await db.get_candidate(application["candidate_id"])
    job = await db.get_job(application["job_id"])

    if not candidate or not job:
        raise HTTPException(status_code=404, detail="Candidate or job not found")

    # Create phone screen record
    phone_screen_data = {
        "application_id": request.application_id,
        "phone_number": request.phone_number,
        "scheduled_at": request.scheduled_at.isoformat() if request.scheduled_at else None,
        "status": "scheduled" if request.scheduled_at else "calling",
    }

    phone_screen = await db.create_phone_screen(phone_screen_data)

    # Update application status to indicate phone screening
    await db.update_application(request.application_id, {"status": "assessment"})

    # If no scheduled time, initiate call immediately
    if not request.scheduled_at:
        candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
        skills = job.get("skills_matrix", {}).get("required", [])
        skills_list = [s.get("skill", s) if isinstance(s, dict) else s for s in skills[:5]]

        background_tasks.add_task(
            _initiate_vapi_call,
            phone_screen_id=phone_screen["id"],
            phone_number=request.phone_number,
            candidate_name=candidate_name or "the candidate",
            job_title=job.get("title", "the position"),
            company_name="TalentAI",  # TODO: Get from company settings
            skills_to_probe=skills_list,
        )

    return {
        "phone_screen_id": phone_screen["id"],
        "status": phone_screen["status"],
        "scheduled_at": request.scheduled_at,
        "message": "Call scheduled" if request.scheduled_at else "Initiating call...",
    }


async def _initiate_vapi_call(
    phone_screen_id: str,
    phone_number: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    skills_to_probe: list[str],
) -> None:
    """Background task to initiate Vapi call."""
    try:
        result = await vapi_service.initiate_call(
            phone_number=phone_number,
            candidate_name=candidate_name,
            job_title=job_title,
            company_name=company_name,
            skills_to_probe=skills_to_probe,
            metadata={"phone_screen_id": phone_screen_id},
        )

        await db.update_phone_screen(
            phone_screen_id,
            {
                "vapi_call_id": result.get("id"),
                "status": "in_progress",
                "started_at": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        await db.update_phone_screen(
            phone_screen_id,
            {
                "status": "failed",
                "error_message": str(e),
            },
        )


# ============================================
# WEBHOOK HANDLING
# ============================================


@router.post("/webhook")
async def vapi_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Webhook endpoint for Vapi call events.

    Handles:
    - call-started: Call connected
    - call-ended: Call finished, transcript available
    - transcript: Real-time transcript updates
    """
    # Get raw body for signature verification
    body = await request.body()

    # Verify webhook signature
    signature = request.headers.get("X-Vapi-Signature", "")
    if not vapi_service.verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    payload_dict = await request.json()
    payload = VapiWebhookPayload(**payload_dict)

    event_type = payload.type
    call_id = payload.get_call_id()

    if not call_id:
        return {"status": "ignored", "reason": "no call_id"}

    # Find phone screen by Vapi call ID
    phone_screen = await db.get_phone_screen_by_vapi_call_id(call_id)
    if not phone_screen:
        # Try to find by pending call ID pattern
        return {"status": "ignored", "reason": "phone_screen not found"}

    # Handle different event types
    if event_type == "call-started":
        await db.update_phone_screen(
            phone_screen["id"],
            {
                "status": "in_progress",
                "started_at": datetime.utcnow().isoformat(),
            },
        )

    elif event_type == "call-ended":
        update_data = {
            "status": "completed",
            "ended_at": datetime.utcnow().isoformat(),
            "duration_seconds": payload.get_duration(),
            "recording_url": payload.get_recording_url(),
            "transcript": payload.get_transcript(),
            "ended_reason": payload.get_ended_reason(),
        }

        # Handle call failure reasons
        ended_reason = payload.get_ended_reason()
        if ended_reason in ["no-answer", "busy", "voicemail"]:
            update_data["status"] = "no_answer"
        elif ended_reason in ["failed", "error"]:
            update_data["status"] = "failed"
            update_data["error_message"] = ended_reason

        await db.update_phone_screen(phone_screen["id"], update_data)

        # Trigger analysis in background if call completed successfully
        if update_data["status"] == "completed":
            background_tasks.add_task(
                _analyze_phone_screen,
                phone_screen_id=phone_screen["id"],
            )

    elif event_type == "transcript":
        # Real-time transcript update
        transcript = payload.get_transcript()
        if transcript:
            await db.update_phone_screen(
                phone_screen["id"],
                {"transcript": transcript},
            )

    elif event_type == "status-update":
        # Status updates during the call
        pass  # We handle this through other events

    return {"status": "processed", "event_type": event_type}


async def _analyze_phone_screen(phone_screen_id: str) -> None:
    """Background task to analyze completed phone screen."""
    from app.agents.coordinator import agent_coordinator

    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        return

    application = await db.get_application(phone_screen["application_id"])
    if not application:
        return

    job = await db.get_job(application["job_id"])
    if not job:
        return

    try:
        # Run phone screen analysis via agent
        result = await agent_coordinator.run_phone_screen_analysis(
            transcript=phone_screen.get("transcript", []),
            job_requirements={
                "title": job.get("title"),
                "skills_matrix": job.get("skills_matrix"),
                "evaluation_criteria": job.get("evaluation_criteria"),
            },
        )

        await db.update_phone_screen(
            phone_screen_id,
            {
                "analysis": result.get("analysis"),
                "overall_score": result.get("overall_score"),
                "recommendation": result.get("recommendation"),
                "confidence_level": result.get("confidence_level"),
                "summary": result.get("summary"),
                "status": "analyzed",
                "analyzed_at": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        # Keep status as completed if analysis fails
        print(f"Phone screen analysis failed: {e}")
        await db.update_phone_screen(
            phone_screen_id,
            {"error_message": f"Analysis failed: {str(e)}"},
        )


# ============================================
# RETRIEVAL
# ============================================


@router.get("/{phone_screen_id}", response_model=PhoneScreenWithCandidateResponse)
async def get_phone_screen(phone_screen_id: str) -> dict[str, Any]:
    """Get phone screen details including candidate and job info."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    # Get related application, candidate, and job
    application = await db.get_application(phone_screen["application_id"])
    candidate = await db.get_candidate(application["candidate_id"]) if application else None
    job = await db.get_job(application["job_id"]) if application else None

    return {
        **phone_screen,
        "candidate": candidate,
        "job": job,
    }


@router.get("/application/{application_id}", response_model=PhoneScreenResponse)
async def get_phone_screen_for_application(application_id: str) -> dict[str, Any]:
    """Get phone screen for a specific application."""
    phone_screen = await db.get_phone_screen_by_application(application_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")
    return phone_screen


@router.get("", response_model=PhoneScreenListResponse)
async def list_phone_screens(
    status: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """List all phone screens with optional filtering."""
    phone_screens = await db.list_phone_screens(status=status, limit=limit)
    return {
        "total": len(phone_screens),
        "phone_screens": phone_screens,
    }


# ============================================
# ACTIONS
# ============================================


@router.post("/{phone_screen_id}/approve")
async def approve_phone_screen(phone_screen_id: str) -> dict[str, Any]:
    """Approve candidate for offer after phone screen."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    if phone_screen.get("status") not in ["completed", "analyzed"]:
        raise HTTPException(status_code=400, detail="Phone screen not yet completed")

    # Update application status to offer
    await db.update_application(
        phone_screen["application_id"],
        {
            "status": "offer",
            "assessed_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "status": "approved_for_offer",
        "phone_screen_id": phone_screen_id,
        "application_id": phone_screen["application_id"],
    }


@router.post("/{phone_screen_id}/reject")
async def reject_after_phone_screen(
    phone_screen_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """Reject candidate after phone screen."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    update_data = {
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
    }
    if reason:
        update_data["rejection_reason"] = reason

    await db.update_application(phone_screen["application_id"], update_data)

    return {
        "status": "rejected",
        "phone_screen_id": phone_screen_id,
        "application_id": phone_screen["application_id"],
    }


@router.post("/{phone_screen_id}/retry")
async def retry_phone_screen(
    phone_screen_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Retry a failed or no-answer phone screen."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    if phone_screen.get("status") not in ["failed", "no_answer", "cancelled"]:
        raise HTTPException(status_code=400, detail="Can only retry failed/no-answer calls")

    if phone_screen.get("attempt_number", 1) >= phone_screen.get("max_attempts", 3):
        raise HTTPException(status_code=400, detail="Maximum retry attempts reached")

    # Get candidate and job info
    application = await db.get_application(phone_screen["application_id"])
    candidate = await db.get_candidate(application["candidate_id"])
    job = await db.get_job(application["job_id"])

    # Update retry count and status
    new_attempt = (phone_screen.get("attempt_number", 1) or 1) + 1
    await db.update_phone_screen(
        phone_screen_id,
        {
            "status": "calling",
            "attempt_number": new_attempt,
            "error_message": None,
        },
    )

    # Initiate new call
    candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
    skills = job.get("skills_matrix", {}).get("required", [])
    skills_list = [s.get("skill", s) if isinstance(s, dict) else s for s in skills[:5]]

    background_tasks.add_task(
        _initiate_vapi_call,
        phone_screen_id=phone_screen_id,
        phone_number=phone_screen["phone_number"],
        candidate_name=candidate_name or "the candidate",
        job_title=job.get("title", "the position"),
        company_name="TalentAI",
        skills_to_probe=skills_list,
    )

    return {
        "status": "retrying",
        "phone_screen_id": phone_screen_id,
        "attempt_number": new_attempt,
    }


@router.post("/{phone_screen_id}/cancel")
async def cancel_phone_screen(phone_screen_id: str) -> dict[str, Any]:
    """Cancel a scheduled phone screen."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    if phone_screen.get("status") not in ["scheduled", "calling"]:
        raise HTTPException(status_code=400, detail="Can only cancel scheduled calls")

    await db.update_phone_screen(
        phone_screen_id,
        {"status": "cancelled"},
    )

    return {
        "status": "cancelled",
        "phone_screen_id": phone_screen_id,
    }


@router.post("/{phone_screen_id}/analyze")
async def trigger_analysis(
    phone_screen_id: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
) -> dict[str, Any]:
    """Manually trigger analysis for a completed phone screen."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    if phone_screen.get("status") not in ["completed", "analyzed"]:
        raise HTTPException(status_code=400, detail="Phone screen not completed")

    if phone_screen.get("status") == "analyzed" and not force:
        raise HTTPException(
            status_code=400,
            detail="Already analyzed. Use force=true to re-analyze.",
        )

    background_tasks.add_task(_analyze_phone_screen, phone_screen_id)

    return {
        "status": "analysis_triggered",
        "phone_screen_id": phone_screen_id,
    }
