"""Phone Interview API endpoints for web-based interviews."""

import json
import logging
import secrets
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.phone_interview_agent import phone_interview_agent
from app.config import settings
from app.services.supabase import db

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================
# Schemas
# ============================================


class ScheduleWebInterviewRequest(BaseModel):
    """Request to schedule a web-based interview."""
    application_id: str
    is_simulation: bool = False


class ScheduleWebInterviewResponse(BaseModel):
    """Response with interview link."""
    phone_screen_id: str
    access_token: str
    interview_url: str
    expires_at: str
    interview_mode: str


class InterviewInfoResponse(BaseModel):
    """Public interview info (no auth required)."""
    interview_id: str
    candidate_name: str
    job_title: str
    company_name: str
    status: str
    is_simulation: bool


class CompleteInterviewRequest(BaseModel):
    """Request to complete an interview."""
    pass  # No body needed, just marks complete


# ============================================
# SSE Event Generator
# ============================================


async def sse_event_generator(
    phone_screen_id: str,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for streaming interview responses."""
    try:
        # Get phone screen and related data
        phone_screen = await db.get_phone_screen(phone_screen_id)
        if not phone_screen:
            yield f"event: error\ndata: {json.dumps({'error': 'Interview not found'})}\n\n"
            return

        application = await db.get_application(phone_screen["application_id"])
        if not application:
            yield f"event: error\ndata: {json.dumps({'error': 'Application not found'})}\n\n"
            return

        candidate = await db.get_candidate(application["candidate_id"])
        job = await db.get_job(application["job_id"])

        if not candidate or not job:
            yield f"event: error\ndata: {json.dumps({'error': 'Missing candidate or job data'})}\n\n"
            return

        # Build context
        candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip() or "Candidate"
        job_title = job.get("title", "the position")
        skills_matrix = job.get("skills_matrix", {})
        skills_to_probe = [
            s.get("skill", s) if isinstance(s, dict) else s
            for s in skills_matrix.get("required", [])[:5]
        ]

        # Get existing transcript
        transcript = phone_screen.get("transcript", [])
        conversation_state = phone_screen.get("conversation_state", {})

        # Yield thinking event
        yield f"event: thinking\ndata: {json.dumps({'status': 'processing', 'message': 'Thinking...'})}\n\n"

        # Save user message to transcript
        user_entry = {
            "role": "user",
            "content": user_message,
            "timestamp": datetime.utcnow().isoformat(),
        }
        transcript.append(user_entry)

        # Generate streaming response
        full_response = ""
        async for chunk in phone_interview_agent.generate_response(
            candidate_name=candidate_name,
            job_title=job_title,
            skills_to_probe=skills_to_probe,
            transcript=transcript[:-1],  # Exclude current message as it's passed separately
            user_message=user_message,
        ):
            full_response += chunk
            yield f"event: message_chunk\ndata: {json.dumps({'text': chunk})}\n\n"

        # Save assistant response to transcript
        assistant_entry = {
            "role": "assistant",
            "content": full_response,
            "timestamp": datetime.utcnow().isoformat(),
        }
        transcript.append(assistant_entry)

        # Check for wrap-up phase
        if phone_interview_agent.detect_wrap_up_trigger(full_response):
            conversation_state["in_wrap_up"] = True
            conversation_state["wrap_up_messages"] = conversation_state.get("wrap_up_messages", 0) + 1

        # Check if interview should end
        should_end = phone_interview_agent.should_end_interview(transcript, conversation_state)
        if should_end:
            conversation_state["is_complete"] = True

        # Update phone screen with new transcript and state
        await db.update_phone_screen(
            phone_screen_id,
            {
                "transcript": transcript,
                "conversation_state": conversation_state,
                "status": "completed" if should_end else "in_progress",
                "ended_at": datetime.utcnow().isoformat() if should_end else None,
            },
        )

        # Yield completion event
        yield f"event: complete\ndata: {json.dumps({'status': 'done', 'should_end': should_end})}\n\n"

    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': 'processing_error', 'message': str(e)})}\n\n"


# ============================================
# Public Endpoints (No Auth Required)
# ============================================


@router.get("/token/{token}", response_model=InterviewInfoResponse)
async def get_interview_by_token(token: str) -> dict[str, Any]:
    """
    Get interview info by access token.

    This is a PUBLIC endpoint for candidates - no auth required.
    """
    phone_screen = await db.get_phone_screen_by_token(token)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found or expired")

    # Check token expiration
    token_expires = phone_screen.get("token_expires_at")
    if token_expires:
        expires_dt = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_dt.replace(tzinfo=None):
            raise HTTPException(status_code=401, detail="Interview link has expired")

    # Get related data
    application = await db.get_application(phone_screen["application_id"])
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    job = await db.get_job(application["job_id"])

    candidate_name = ""
    if candidate:
        candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()

    return {
        "interview_id": phone_screen["id"],
        "candidate_name": candidate_name or "Candidate",
        "job_title": job.get("title", "Position") if job else "Position",
        "company_name": settings.app_name,
        "status": phone_screen.get("status", "pending"),
        "is_simulation": phone_screen.get("interview_mode") == "simulation",
    }


@router.get("/token/{token}/transcript")
async def get_interview_transcript(token: str) -> dict[str, Any]:
    """
    Get the current interview transcript.

    PUBLIC endpoint for candidates.
    """
    phone_screen = await db.get_phone_screen_by_token(token)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found or expired")

    # Check token expiration
    token_expires = phone_screen.get("token_expires_at")
    if token_expires:
        expires_dt = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_dt.replace(tzinfo=None):
            raise HTTPException(status_code=401, detail="Interview link has expired")

    return {
        "interview_id": phone_screen["id"],
        "transcript": phone_screen.get("transcript", []),
        "status": phone_screen.get("status", "pending"),
        "conversation_state": phone_screen.get("conversation_state", {}),
    }


@router.get("/token/{token}/start")
async def start_interview(token: str) -> StreamingResponse:
    """
    Start the interview and get the opening message.

    PUBLIC endpoint - returns SSE stream with opening message.
    """
    phone_screen = await db.get_phone_screen_by_token(token)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found or expired")

    # Check token expiration
    token_expires = phone_screen.get("token_expires_at")
    if token_expires:
        expires_dt = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_dt.replace(tzinfo=None):
            raise HTTPException(status_code=401, detail="Interview link has expired")

    # Check if already completed
    if phone_screen.get("status") in ["completed", "analyzed"]:
        raise HTTPException(status_code=400, detail="Interview already completed")

    async def start_stream() -> AsyncGenerator[str, None]:
        try:
            # Get related data
            application = await db.get_application(phone_screen["application_id"])
            candidate = await db.get_candidate(application["candidate_id"]) if application else None
            job = await db.get_job(application["job_id"]) if application else None

            candidate_name = ""
            if candidate:
                candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()

            job_title = job.get("title", "the position") if job else "the position"

            # Generate opening message
            opening = await phone_interview_agent.generate_opening_message(
                candidate_name=candidate_name or "there",
                job_title=job_title,
            )

            # Save to transcript
            transcript = phone_screen.get("transcript", [])
            transcript.append({
                "role": "assistant",
                "content": opening,
                "timestamp": datetime.utcnow().isoformat(),
            })

            # Update phone screen
            await db.update_phone_screen(
                phone_screen["id"],
                {
                    "transcript": transcript,
                    "status": "in_progress",
                    "started_at": datetime.utcnow().isoformat(),
                    "conversation_state": {"current_question_index": 0},
                },
            )

            # Stream the opening message
            yield f"event: thinking\ndata: {json.dumps({'status': 'processing'})}\n\n"

            for chunk in opening.split(". "):
                if chunk:
                    yield f"event: message_chunk\ndata: {json.dumps({'text': chunk + '. '})}\n\n"

            yield f"event: complete\ndata: {json.dumps({'status': 'done', 'should_end': False})}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        start_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/token/{token}/message")
async def send_interview_message(
    token: str,
    content: str = Query(..., description="The candidate's message"),
) -> StreamingResponse:
    """
    Send a message in the interview and stream the AI response.

    PUBLIC endpoint - returns SSE stream.
    """
    phone_screen = await db.get_phone_screen_by_token(token)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found or expired")

    # Check token expiration
    token_expires = phone_screen.get("token_expires_at")
    if token_expires:
        expires_dt = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_dt.replace(tzinfo=None):
            raise HTTPException(status_code=401, detail="Interview link has expired")

    # Check if already completed
    if phone_screen.get("status") in ["completed", "analyzed"]:
        raise HTTPException(status_code=400, detail="Interview already completed")

    return StreamingResponse(
        sse_event_generator(phone_screen["id"], content),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/token/{token}/complete")
async def complete_interview(
    token: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Mark interview as complete and trigger analysis.

    PUBLIC endpoint.
    """
    phone_screen = await db.get_phone_screen_by_token(token)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Update status
    await db.update_phone_screen(
        phone_screen["id"],
        {
            "status": "completed",
            "ended_at": datetime.utcnow().isoformat(),
        },
    )

    # Trigger analysis in background
    background_tasks.add_task(
        _analyze_phone_interview,
        phone_screen_id=phone_screen["id"],
    )

    return {
        "status": "completed",
        "interview_id": phone_screen["id"],
        "message": "Interview completed. Analysis running in background.",
    }


# ============================================
# Authenticated Endpoints
# ============================================


@router.post("/schedule-web", response_model=ScheduleWebInterviewResponse)
async def schedule_web_interview(
    request: ScheduleWebInterviewRequest,
) -> dict[str, Any]:
    """
    Schedule a web-based interview for a candidate.

    Returns an interview link that can be sent to the candidate.
    """
    # Verify application exists
    application = await db.get_application(request.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check for existing phone screen
    existing = await db.get_phone_screen_by_application(request.application_id)
    if existing and existing.get("status") not in ["cancelled", "failed", "no_answer"]:
        # Return existing if it's a web interview
        if existing.get("interview_mode") == "web" and existing.get("access_token"):
            return {
                "phone_screen_id": existing["id"],
                "access_token": existing["access_token"],
                "interview_url": f"/phone-interview/{existing['access_token']}",
                "expires_at": existing.get("token_expires_at", ""),
                "interview_mode": existing.get("interview_mode", "web"),
            }
        raise HTTPException(
            status_code=400,
            detail=f"Phone screen already exists with status: {existing.get('status')}",
        )

    # Generate access token
    access_token = secrets.token_urlsafe(32)
    token_expires = datetime.utcnow() + timedelta(days=7)

    # Create phone screen record
    interview_mode = "simulation" if request.is_simulation else "web"
    phone_screen_data = {
        "application_id": request.application_id,
        "interview_mode": interview_mode,
        "access_token": access_token,
        "token_expires_at": token_expires.isoformat(),
        "status": "scheduled",
        "transcript": [],
        "conversation_state": {},
    }

    phone_screen = await db.create_phone_screen(phone_screen_data)

    # Update application status
    if not request.is_simulation:
        await db.update_application(request.application_id, {"status": "assessment"})

    return {
        "phone_screen_id": phone_screen["id"],
        "access_token": access_token,
        "interview_url": f"/phone-interview/{access_token}",
        "expires_at": token_expires.isoformat(),
        "interview_mode": interview_mode,
    }


@router.get("/{phone_screen_id}")
async def get_phone_interview(phone_screen_id: str) -> dict[str, Any]:
    """Get phone interview details (authenticated endpoint)."""
    phone_screen = await db.get_phone_screen(phone_screen_id)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Get related data
    application = await db.get_application(phone_screen["application_id"])
    candidate = await db.get_candidate(application["candidate_id"]) if application else None
    job = await db.get_job(application["job_id"]) if application else None

    return {
        **phone_screen,
        "candidate": candidate,
        "job": job,
    }


# ============================================
# Background Tasks
# ============================================


async def _analyze_phone_interview(phone_screen_id: str) -> None:
    """Background task to analyze completed web interview."""
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
        # Run phone screen analysis via existing agent
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
        logger.exception("Phone interview analysis failed: %s", e)
        await db.update_phone_screen(
            phone_screen_id,
            {"error_message": f"Analysis failed: {str(e)}"},
        )
