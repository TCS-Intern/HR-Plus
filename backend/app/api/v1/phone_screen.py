"""Phone Screen API endpoints."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.schemas.phone_screen import (
    PhoneScreenListResponse,
    PhoneScreenResponse,
    PhoneScreenScheduleRequest,
    PhoneScreenWithCandidateResponse,
    VapiWebhookPayload,
)
from app.services.supabase import db
from app.services.vapi import vapi_service

router = APIRouter()


# ============================================
# CONFIGURATION
# ============================================


@router.post("/configure-assistant")
async def configure_vapi_assistant(
    company_name: str = "Telentic",
    webhook_url: str | None = None,
) -> dict[str, Any]:
    """
    Configure the Vapi assistant with proper phone screening settings.

    Call this once to set up your Vapi assistant for phone screening.

    Args:
        company_name: Your company name (used in greetings)
        webhook_url: Your webhook URL (e.g., https://yourapi.com/api/v1/phone-screen/webhook)
    """
    if not vapi_service.assistant_id:
        raise HTTPException(
            status_code=400,
            detail="VAPI_ASSISTANT_ID not configured in environment",
        )

    if not vapi_service.api_key:
        raise HTTPException(
            status_code=400,
            detail="VAPI_API_KEY not configured in environment",
        )

    try:
        result = await vapi_service.update_assistant(
            assistant_id=vapi_service.assistant_id,
            name="Telentic Phone Screener",
            company_name=company_name,
            webhook_url=webhook_url,
        )

        return {
            "status": "configured",
            "assistant_id": result.get("id"),
            "name": result.get("name"),
            "message": "Vapi assistant configured for phone screening",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to configure assistant: {str(e)}",
        )


@router.get("/config-status")
async def get_vapi_config_status() -> dict[str, Any]:
    """Check if Vapi is properly configured."""
    return {
        "api_key_set": bool(vapi_service.api_key),
        "assistant_id_set": bool(vapi_service.assistant_id),
        "assistant_id": vapi_service.assistant_id if vapi_service.assistant_id else None,
        "phone_number_set": bool(vapi_service.phone_number),
        "webhook_secret_set": bool(vapi_service.webhook_secret),
        "ready": bool(
            vapi_service.api_key and vapi_service.assistant_id and vapi_service.phone_number
        ),
    }


@router.get("/verify-api-key")
async def verify_vapi_api_key() -> dict[str, Any]:
    """
    Verify the Vapi API key is valid by making a test API call.
    This helps diagnose authentication issues.
    """
    import httpx

    if not vapi_service.api_key:
        return {
            "valid": False,
            "error": "VAPI_API_KEY not configured",
            "suggestion": "Set VAPI_API_KEY in your environment variables",
        }

    # Try to list assistants - this is a simple read operation
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.vapi.ai/assistant",
                headers={
                    "Authorization": f"Bearer {vapi_service.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )

            if response.status_code == 200:
                assistants = response.json()
                return {
                    "valid": True,
                    "message": "API key is valid!",
                    "assistants_count": len(assistants) if isinstance(assistants, list) else 0,
                }
            elif response.status_code == 401:
                return {
                    "valid": False,
                    "error": "Invalid API key (401 Unauthorized)",
                    "suggestion": "Check your VAPI_API_KEY. Get it from https://dashboard.vapi.ai/api-keys",
                    "key_preview": f"{vapi_service.api_key[:8]}...{vapi_service.api_key[-4:]}" if len(vapi_service.api_key) > 12 else "key too short",
                }
            else:
                return {
                    "valid": False,
                    "error": f"Unexpected status: {response.status_code}",
                    "response": response.text[:200],
                }

    except Exception as e:
        return {
            "valid": False,
            "error": f"Request failed: {str(e)}",
        }


@router.post("/test-call")
async def test_vapi_call(
    phone_number: str,
    candidate_name: str = "Test Candidate",
    job_title: str = "Software Engineer",
) -> dict[str, Any]:
    """
    Test endpoint to directly trigger a Vapi phone call.
    Use this to verify Vapi integration is working correctly.

    Args:
        phone_number: Phone number in E.164 format (e.g., +1234567890)
        candidate_name: Name to use in the call
        job_title: Job title for the screening
    """
    if not vapi_service.api_key or not vapi_service.assistant_id:
        raise HTTPException(
            status_code=400,
            detail="Vapi not configured. Set VAPI_API_KEY and VAPI_ASSISTANT_ID.",
        )

    if not vapi_service.phone_number:
        raise HTTPException(
            status_code=400,
            detail="VAPI_PHONE_NUMBER not configured. Cannot make outbound calls.",
        )

    try:
        result = await vapi_service.initiate_call(
            phone_number=phone_number,
            candidate_name=candidate_name,
            job_title=job_title,
            company_name="Telentic",
            skills_to_probe=["Python", "React", "TypeScript", "AWS"],
            metadata={"test_call": True},
        )

        return {
            "status": "call_initiated",
            "call_id": result.get("id"),
            "phone_number": phone_number,
            "candidate_name": candidate_name,
            "message": f"Call initiated to {phone_number}. You should receive the call shortly!",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate call: {str(e)}",
        )


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
        candidate_name = (
            f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
        )
        skills = job.get("skills_matrix", {}).get("required", [])
        skills_list = [s.get("skill", s) if isinstance(s, dict) else s for s in skills[:5]]

        background_tasks.add_task(
            _initiate_vapi_call,
            phone_screen_id=phone_screen["id"],
            phone_number=request.phone_number,
            candidate_name=candidate_name or "the candidate",
            job_title=job.get("title", "the position"),
            company_name="Telentic",  # TODO: Get from company settings
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
        company_name="Telentic",
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


@router.post("/{phone_screen_id}/simulate")
async def simulate_phone_screen(
    phone_screen_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Simulate a phone screen with realistic mock data.

    This bypasses the actual Vapi call and generates a simulated
    conversation transcript, then runs the AI analysis.
    """
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Phone screen not found")

    if phone_screen.get("status") not in ["scheduled", "failed", "no_answer"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot simulate: phone screen status is {phone_screen.get('status')}",
        )

    # Get candidate and job info
    application = await db.get_application(phone_screen["application_id"])
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    job = await db.get_job(application["job_id"])

    if not candidate or not job:
        raise HTTPException(status_code=404, detail="Candidate or job not found")

    candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
    job_title = job.get("title", "the position")
    skills = job.get("skills_matrix", {}).get("required", [])
    skills_list = [s.get("skill", s) if isinstance(s, dict) else s for s in skills[:5]]

    # Generate simulated transcript
    simulated_transcript = _generate_simulated_transcript(
        candidate_name=candidate_name,
        job_title=job_title,
        skills=skills_list,
    )

    # Update phone screen with simulated data
    await db.update_phone_screen(
        phone_screen_id,
        {
            "status": "completed",
            "started_at": datetime.utcnow().isoformat(),
            "ended_at": datetime.utcnow().isoformat(),
            "duration_seconds": 420,  # 7 minutes simulated call
            "transcript": simulated_transcript,
            "vapi_call_id": f"simulated-{phone_screen_id}",
            "ended_reason": "completed",
        },
    )

    # Trigger analysis in background
    background_tasks.add_task(_analyze_phone_screen, phone_screen_id)

    return {
        "status": "simulated",
        "phone_screen_id": phone_screen_id,
        "message": "Phone screen simulated successfully. Analysis running in background.",
        "transcript_messages": len(simulated_transcript),
    }


def _generate_simulated_transcript(
    candidate_name: str,
    job_title: str,
    skills: list[str],
) -> list[dict[str, Any]]:
    """Generate a realistic phone screen transcript."""
    import random

    skills_str = ", ".join(skills[:3]) if skills else "relevant technologies"

    # Randomize some values for realism
    years_exp = random.randint(4, 8)
    salary_min = random.randint(140, 160)
    salary_max = salary_min + random.randint(20, 40)
    notice_weeks = random.choice([2, 3, 4])

    transcript = [
        {
            "role": "assistant",
            "content": f"Hello, this is the AI recruiter from Telentic. Am I speaking with {candidate_name}?",
            "timestamp": "00:00:05",
        },
        {
            "role": "user",
            "content": f"Yes, this is {candidate_name.split()[0]}. Thanks for calling!",
            "timestamp": "00:00:12",
        },
        {
            "role": "assistant",
            "content": f"Great to connect with you! I'm calling regarding the {job_title} position you applied for. Do you have about 10 minutes to chat?",
            "timestamp": "00:00:18",
        },
        {
            "role": "user",
            "content": "Yes, absolutely. I've been looking forward to this call.",
            "timestamp": "00:00:28",
        },
        {
            "role": "assistant",
            "content": f"Wonderful! Let's start with your experience. Can you tell me about your background with {skills_str}?",
            "timestamp": "00:00:35",
        },
        {
            "role": "user",
            "content": f"Sure! I've been working in software engineering for about {years_exp} years now. In my current role, I've been heavily focused on {skills[0] if skills else 'full-stack development'}. I led a team that rebuilt our main platform, improving performance by 40%. I've also worked extensively with {skills[1] if len(skills) > 1 else 'modern frameworks'} and {skills[2] if len(skills) > 2 else 'cloud technologies'}.",
            "timestamp": "00:00:45",
        },
        {
            "role": "assistant",
            "content": "That's impressive! Can you tell me about a challenging technical problem you solved recently?",
            "timestamp": "00:01:30",
        },
        {
            "role": "user",
            "content": "Definitely. We had a major scaling issue where our API response times were degrading as traffic increased. I designed and implemented a caching layer with Redis, optimized our database queries, and introduced lazy loading. This reduced response times by 60% and allowed us to handle 3x more traffic without additional infrastructure.",
            "timestamp": "00:01:40",
        },
        {
            "role": "assistant",
            "content": "Excellent problem-solving. What interests you about this opportunity?",
            "timestamp": "00:02:25",
        },
        {
            "role": "user",
            "content": f"I'm really excited about the {job_title} role because it aligns with my experience and career goals. I'm looking to work on products that have real impact, and Telentic's mission to transform talent acquisition resonates with me. Plus, I'm eager to work with cutting-edge AI technologies.",
            "timestamp": "00:02:35",
        },
        {
            "role": "assistant",
            "content": "That's great to hear. Let's talk about compensation. What are your salary expectations for this role?",
            "timestamp": "00:03:15",
        },
        {
            "role": "user",
            "content": f"Based on my experience and the market research I've done, I'm looking for something in the range of ${salary_min}K to ${salary_max}K, depending on the full compensation package including equity and benefits.",
            "timestamp": "00:03:25",
        },
        {
            "role": "assistant",
            "content": "That's helpful context. What's your current availability? When could you potentially start if an offer was extended?",
            "timestamp": "00:03:50",
        },
        {
            "role": "user",
            "content": f"I have a {notice_weeks}-week notice period at my current company. So I could realistically start within a month to 6 weeks of accepting an offer.",
            "timestamp": "00:04:00",
        },
        {
            "role": "assistant",
            "content": "How would you describe your ideal work environment and team culture?",
            "timestamp": "00:04:25",
        },
        {
            "role": "user",
            "content": "I thrive in collaborative environments where there's a good balance of autonomy and teamwork. I value transparency from leadership, opportunities for mentorship both giving and receiving, and a culture that embraces learning from failures. Remote flexibility is also important to me for work-life balance.",
            "timestamp": "00:04:35",
        },
        {
            "role": "assistant",
            "content": "Those are great values. One more question - where do you see yourself in 3-5 years?",
            "timestamp": "00:05:10",
        },
        {
            "role": "user",
            "content": "I want to grow into a technical leadership role where I can have broader impact. Whether that's leading an engineering team or becoming a principal engineer who shapes technical direction across the organization. I'm also passionate about mentoring junior developers and contributing to engineering culture.",
            "timestamp": "00:05:20",
        },
        {
            "role": "assistant",
            "content": "Thank you for sharing that vision. Do you have any questions for me about the role or company?",
            "timestamp": "00:06:00",
        },
        {
            "role": "user",
            "content": "Yes! I'd love to know more about the team structure and the tech stack I'd be working with day-to-day. Also, what does success look like in the first 90 days?",
            "timestamp": "00:06:10",
        },
        {
            "role": "assistant",
            "content": "Great questions. The team is about 8 engineers, working with Python, React, and various AI/ML technologies. For the first 90 days, we focus on onboarding, shipping your first feature, and building relationships with the team. I'll make sure our hiring manager covers this in detail during the next interview.",
            "timestamp": "00:06:25",
        },
        {
            "role": "user",
            "content": "That sounds great. I'm very interested in moving forward with the process.",
            "timestamp": "00:06:55",
        },
        {
            "role": "assistant",
            "content": f"Excellent, {candidate_name.split()[0]}! Thank you so much for your time today. You'll hear from us within the next few days about next steps. Have a great rest of your day!",
            "timestamp": "00:07:05",
        },
        {
            "role": "user",
            "content": "Thank you! Looking forward to it. Goodbye!",
            "timestamp": "00:07:15",
        },
    ]

    return transcript
