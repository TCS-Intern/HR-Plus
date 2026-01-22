"""Cal.com webhook API endpoints for interview scheduling."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel

from app.services.calcom import calcom_service, calcom_webhook_handler
from app.services.supabase import db

router = APIRouter()


# ============================================
# SCHEMAS
# ============================================


class SchedulingLinkRequest(BaseModel):
    """Request to generate a scheduling link for a candidate."""

    application_id: str
    event_type_slug: str = "interview-30"
    username: str  # Cal.com username


class SchedulingLinkResponse(BaseModel):
    """Response with scheduling link."""

    scheduling_url: str
    application_id: str
    candidate_email: str


# ============================================
# WEBHOOK HANDLING
# ============================================


@router.post("/webhook")
async def calcom_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Webhook endpoint for Cal.com booking events.

    Handles:
    - BOOKING_CREATED: Interview scheduled
    - BOOKING_CANCELLED: Interview cancelled
    - BOOKING_RESCHEDULED: Interview rescheduled
    """
    # Get raw body for signature verification
    body = await request.body()

    # Verify webhook signature
    signature = request.headers.get("X-Cal-Signature-256", "")
    if not calcom_service.verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    payload = await request.json()
    event = calcom_webhook_handler.parse_event(payload)

    event_type = event["event_type"]
    booking_id = event["booking_id"]
    booking_uid = event["booking_uid"]

    if not booking_id:
        return {"status": "ignored", "reason": "no booking_id"}

    # Extract metadata to find related application/assessment
    metadata = event.get("metadata", {})
    application_id = metadata.get("application_id")
    assessment_id = metadata.get("assessment_id")

    # Handle different event types
    if event_type == "BOOKING_CREATED":
        await _handle_booking_created(event, application_id, assessment_id)

    elif event_type == "BOOKING_CANCELLED":
        await _handle_booking_cancelled(event, application_id, assessment_id)

    elif event_type == "BOOKING_RESCHEDULED":
        await _handle_booking_rescheduled(event, application_id, assessment_id)

    return {
        "status": "processed",
        "event_type": event_type,
        "booking_id": booking_id,
    }


async def _handle_booking_created(
    event: dict[str, Any],
    application_id: str | None,
    assessment_id: str | None,
) -> None:
    """Handle new booking creation."""
    booking_data = {
        "calendar_event_id": str(event["booking_id"]),
        "scheduled_at": event["start_time"].isoformat() if event["start_time"] else None,
        "status": "scheduled",
    }

    # Update assessment if we have an assessment_id
    if assessment_id:
        await db.update_assessment(assessment_id, booking_data)

    # Update application status if provided
    if application_id:
        await db.update_application(
            application_id,
            {
                "status": "assessment",
                "current_stage": "interview_scheduled",
            },
        )

    # Try to find assessment by candidate email if no IDs provided
    if not assessment_id and not application_id:
        attendee_email = event.get("attendee_email")
        if attendee_email:
            # Find candidate by email
            candidate = await db.get_candidate_by_email(attendee_email)
            if candidate:
                # Find their pending assessments
                applications = await db.list_applications(
                    candidate_id=candidate["id"],
                    status="assessment",
                )
                for app in applications:
                    assessments = await db.list_assessments(
                        application_id=app["id"],
                        status="pending",
                    )
                    if assessments:
                        # Update the first pending assessment
                        await db.update_assessment(assessments[0]["id"], booking_data)
                        break


async def _handle_booking_cancelled(
    event: dict[str, Any],
    application_id: str | None,
    assessment_id: str | None,
) -> None:
    """Handle booking cancellation."""
    booking_id = str(event["booking_id"])

    # Find assessment by calendar_event_id if no direct ID
    if not assessment_id:
        assessment = await db.get_assessment_by_calendar_event(booking_id)
        if assessment:
            assessment_id = assessment["id"]
            application_id = assessment.get("application_id")

    if assessment_id:
        await db.update_assessment(
            assessment_id,
            {
                "status": "cancelled",
                "scheduled_at": None,
            },
        )

    if application_id:
        await db.update_application(
            application_id,
            {"current_stage": "interview_cancelled"},
        )


async def _handle_booking_rescheduled(
    event: dict[str, Any],
    application_id: str | None,
    assessment_id: str | None,
) -> None:
    """Handle booking reschedule."""
    booking_id = str(event["booking_id"])

    # Find assessment by calendar_event_id if no direct ID
    if not assessment_id:
        assessment = await db.get_assessment_by_calendar_event(booking_id)
        if assessment:
            assessment_id = assessment["id"]

    if assessment_id:
        await db.update_assessment(
            assessment_id,
            {
                "scheduled_at": event["start_time"].isoformat() if event["start_time"] else None,
                "status": "scheduled",
            },
        )


# ============================================
# SCHEDULING ENDPOINTS
# ============================================


@router.post("/scheduling-link", response_model=SchedulingLinkResponse)
async def generate_scheduling_link(request: SchedulingLinkRequest) -> dict[str, Any]:
    """
    Generate a Cal.com scheduling link for a candidate.

    The link can be sent to the candidate to self-schedule their interview.
    """
    # Get application with candidate info
    application = await db.get_application(request.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Generate scheduling link with metadata
    scheduling_url = calcom_service.generate_scheduling_link(
        event_type_slug=request.event_type_slug,
        username=request.username,
        prefill_email=candidate.get("email"),
        prefill_name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
        metadata={
            "application_id": request.application_id,
        },
    )

    return {
        "scheduling_url": scheduling_url,
        "application_id": request.application_id,
        "candidate_email": candidate.get("email"),
    }


@router.get("/event-types")
async def list_event_types() -> dict[str, Any]:
    """List available Cal.com event types (interview types)."""
    if not calcom_service.api_key:
        raise HTTPException(
            status_code=400,
            detail="CALCOM_API_KEY not configured",
        )

    try:
        event_types = await calcom_service.get_event_types()
        return {
            "event_types": event_types,
            "count": len(event_types),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch event types: {str(e)}",
        )


@router.get("/config-status")
async def get_calcom_config_status() -> dict[str, Any]:
    """Check if Cal.com is properly configured."""
    return {
        "api_key_set": bool(calcom_service.api_key),
        "webhook_secret_set": bool(calcom_service.webhook_secret),
        "event_type_id_set": bool(calcom_service.default_event_type_id),
        "ready": bool(calcom_service.api_key),
    }
