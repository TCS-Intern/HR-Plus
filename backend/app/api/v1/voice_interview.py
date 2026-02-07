"""Voice Interview API endpoints for ElevenLabs browser-based voice interviews."""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.elevenlabs import elevenlabs_service
from app.services.supabase import db

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================
# Schemas
# ============================================


class ScheduleVoiceInterviewRequest(BaseModel):
    """Request to schedule a voice interview."""

    application_id: str


class ScheduleVoiceInterviewResponse(BaseModel):
    """Response with voice interview link."""

    phone_screen_id: str
    access_token: str
    interview_url: str
    expires_at: str
    interview_mode: str


class CreateSessionResponse(BaseModel):
    """Response with ElevenLabs signed URL for WebSocket connection."""

    signed_url: str
    agent_id: str


class CompleteVoiceInterviewRequest(BaseModel):
    """Request to complete a voice interview."""

    elevenlabs_conversation_id: str | None = None
    client_transcript: list[dict[str, Any]] | None = None


# ============================================
# Authenticated Endpoints
# ============================================


@router.post("/schedule", response_model=ScheduleVoiceInterviewResponse)
async def schedule_voice_interview(
    request: ScheduleVoiceInterviewRequest,
) -> dict[str, Any]:
    """
    Schedule a voice interview for a candidate.

    Returns an interview link that can be sent to the candidate.
    """
    # Verify application exists
    application = await db.get_application(request.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check for existing phone screen
    existing = await db.get_phone_screen_by_application(request.application_id)
    if existing and existing.get("status") not in ["cancelled", "failed", "no_answer", "completed", "analyzed"]:
        if existing.get("interview_mode") == "voice" and existing.get("access_token"):
            return {
                "phone_screen_id": existing["id"],
                "access_token": existing["access_token"],
                "interview_url": f"/phone-interview/{existing['access_token']}",
                "expires_at": existing.get("token_expires_at", ""),
                "interview_mode": "voice",
            }
        raise HTTPException(
            status_code=400,
            detail=f"Phone screen already exists with status: {existing.get('status')}",
        )

    # Generate access token
    access_token = secrets.token_urlsafe(32)
    token_expires = datetime.utcnow() + timedelta(days=7)

    phone_screen_data = {
        "interview_mode": "voice",
        "access_token": access_token,
        "token_expires_at": token_expires.isoformat(),
        "status": "scheduled",
        "transcript": [],
        "conversation_state": {},
    }

    # Reuse existing cancelled/failed record (unique constraint on application_id)
    if existing:
        phone_screen = await db.update_phone_screen(existing["id"], phone_screen_data)
    else:
        phone_screen_data["application_id"] = request.application_id
        phone_screen = await db.create_phone_screen(phone_screen_data)

    # Update application status
    await db.update_application(request.application_id, {"status": "assessment"})

    return {
        "phone_screen_id": phone_screen["id"],
        "access_token": access_token,
        "interview_url": f"/phone-interview/{access_token}",
        "expires_at": token_expires.isoformat(),
        "interview_mode": "voice",
    }


# ============================================
# Public Endpoints (Token Auth)
# ============================================


@router.post("/token/{token}/session", response_model=CreateSessionResponse)
async def create_voice_session(token: str) -> dict[str, Any]:
    """
    Create an ElevenLabs voice session for the interview.

    Creates a per-session agent with candidate/job-specific prompt,
    gets a signed WebSocket URL, and returns it to the frontend.

    PUBLIC endpoint - authenticated by access token.
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

    # Get related data
    application = await db.get_application(phone_screen["application_id"])
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    job = await db.get_job(application["job_id"])

    candidate_name = "Candidate"
    if candidate:
        candidate_name = (
            f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
            or "Candidate"
        )

    job_title = job.get("title", "the position") if job else "the position"
    skills_matrix = job.get("skills_matrix", {}) if job else {}
    skills_to_probe = [
        s.get("skill", s) if isinstance(s, dict) else s
        for s in skills_matrix.get("required", [])[:5]
    ]

    # Build voice interview prompt
    system_prompt = elevenlabs_service.build_voice_interview_prompt(
        candidate_name=candidate_name,
        job_title=job_title,
        skills_to_probe=skills_to_probe,
    )
    first_message = elevenlabs_service.build_first_message(
        candidate_name=candidate_name,
        job_title=job_title,
    )

    # Create per-session ElevenLabs agent
    agent_data = await elevenlabs_service.create_agent(
        name=f"Voice Interview - {candidate_name} - {job_title}",
        system_prompt=system_prompt,
        first_message=first_message,
    )
    agent_id = agent_data["agent_id"]

    # Get signed URL for WebSocket connection
    signed_url = await elevenlabs_service.get_signed_url(agent_id)

    # Update phone screen with agent info and mark as in_progress
    await db.update_phone_screen(
        phone_screen["id"],
        {
            "status": "in_progress",
            "started_at": datetime.utcnow().isoformat(),
            "conversation_state": {
                "elevenlabs_agent_id": agent_id,
            },
        },
    )

    return {
        "signed_url": signed_url,
        "agent_id": agent_id,
    }


@router.post("/token/{token}/complete")
async def complete_voice_interview(
    token: str,
    request: CompleteVoiceInterviewRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Mark voice interview as complete and trigger analysis.

    Receives the ElevenLabs conversation ID and client-side transcript,
    fetches the authoritative transcript from ElevenLabs, saves to DB,
    and triggers analysis.

    PUBLIC endpoint - authenticated by access token.
    """
    phone_screen = await db.get_phone_screen_by_token(token)
    if not phone_screen:
        raise HTTPException(status_code=404, detail="Interview not found")

    conversation_state = phone_screen.get("conversation_state", {})
    agent_id = conversation_state.get("elevenlabs_agent_id")

    # Build transcript from available sources
    transcript = []

    # Try to get authoritative transcript from ElevenLabs
    if request.elevenlabs_conversation_id:
        try:
            conv_data = await elevenlabs_service.get_conversation(
                request.elevenlabs_conversation_id
            )
            # Parse ElevenLabs transcript format into our standard format
            el_transcript = conv_data.get("transcript", [])
            for entry in el_transcript:
                transcript.append({
                    "role": "assistant" if entry.get("role") == "agent" else "user",
                    "content": entry.get("message", ""),
                    "timestamp": entry.get("time_in_call_secs", ""),
                })
        except Exception as e:
            logger.warning("Failed to fetch ElevenLabs transcript: %s", e)

    # Fall back to client transcript if ElevenLabs fetch failed
    if not transcript and request.client_transcript:
        transcript = [
            {
                "role": entry.get("role", "user"),
                "content": entry.get("content", ""),
                "timestamp": entry.get("timestamp", ""),
            }
            for entry in request.client_transcript
        ]

    # Update phone screen
    conversation_state["elevenlabs_conversation_id"] = request.elevenlabs_conversation_id
    await db.update_phone_screen(
        phone_screen["id"],
        {
            "status": "completed",
            "ended_at": datetime.utcnow().isoformat(),
            "transcript": transcript,
            "conversation_state": conversation_state,
        },
    )

    # Trigger analysis in background
    background_tasks.add_task(
        _analyze_voice_interview,
        phone_screen_id=phone_screen["id"],
        agent_id=agent_id,
    )

    return {
        "status": "completed",
        "interview_id": phone_screen["id"],
        "message": "Voice interview completed. Analysis running in background.",
    }


# ============================================
# Background Tasks
# ============================================


async def _analyze_voice_interview(
    phone_screen_id: str,
    agent_id: str | None = None,
) -> None:
    """Background task to analyze completed voice interview and cleanup."""
    from app.agents.coordinator import agent_coordinator

    # Cleanup: delete per-session agent
    if agent_id:
        try:
            await elevenlabs_service.delete_agent(agent_id)
        except Exception as e:
            logger.warning("Failed to delete ElevenLabs agent %s: %s", agent_id, e)

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
        # Reuse the same analysis pipeline as web/phone interviews
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
        logger.exception("Voice interview analysis failed: %s", e)
        await db.update_phone_screen(
            phone_screen_id,
            {"error_message": f"Analysis failed: {str(e)}"},
        )
