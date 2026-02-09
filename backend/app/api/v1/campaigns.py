"""Campaigns API endpoints for managing outreach campaigns."""

import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.config import settings
from app.schemas.campaigns import (
    AddCandidatesToCampaignRequest,
    CampaignCreateRequest,
    CampaignListResponse,
    CampaignResponse,
    CampaignStatsResponse,
    CampaignStatusUpdateRequest,
    CampaignUpdateRequest,
    OutreachMessageListResponse,
)
from app.services.email import email_service, resend_webhook_handler
from app.services.supabase import db
from app.utils.templates import render_template

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================
# CAMPAIGN CRUD
# ============================================


@router.post("", response_model=CampaignResponse)
async def create_campaign(request: CampaignCreateRequest) -> dict[str, Any]:
    """Create a new outreach campaign."""
    # Verify job exists
    job = await db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    campaign_data = {
        "job_id": request.job_id,
        "name": request.name,
        "description": request.description,
        "sequence": [step.model_dump() for step in request.sequence],
        "sender_email": request.sender_email,
        "sender_name": request.sender_name,
        "reply_to_email": request.reply_to_email,
        "status": "draft",
        "total_recipients": 0,
        "messages_sent": 0,
        "messages_opened": 0,
        "messages_clicked": 0,
        "messages_replied": 0,
    }

    return await db.create_campaign(campaign_data)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str) -> dict[str, Any]:
    """Get a campaign by ID."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: str,
    request: CampaignUpdateRequest,
) -> dict[str, Any]:
    """Update a campaign."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") not in ["draft", "paused"]:
        raise HTTPException(
            status_code=400, detail="Can only edit campaigns that are draft or paused"
        )

    update_data = request.model_dump(exclude_unset=True)
    if "sequence" in update_data and update_data["sequence"]:
        update_data["sequence"] = [
            step.model_dump() if hasattr(step, "model_dump") else step
            for step in update_data["sequence"]
        ]
    update_data["updated_at"] = datetime.utcnow().isoformat()

    return await db.update_campaign(campaign_id, update_data)


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    job_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """List campaigns with optional filtering."""
    campaigns = await db.list_campaigns(
        job_id=job_id,
        status=status,
        limit=limit,
    )
    return {
        "total": len(campaigns),
        "campaigns": campaigns,
    }


# ============================================
# CAMPAIGN STATUS & CONTROL
# ============================================


@router.put("/{campaign_id}/status", response_model=CampaignResponse)
async def update_campaign_status(
    campaign_id: str,
    request: CampaignStatusUpdateRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Update campaign status (start, pause, complete)."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    current_status = campaign.get("status")
    new_status = request.status.value

    # Validate status transition
    valid_transitions = {
        "draft": ["active"],
        "active": ["paused", "completed"],
        "paused": ["active", "completed"],
        "completed": [],
    }

    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400, detail=f"Cannot transition from {current_status} to {new_status}"
        )

    update_data = {
        "status": new_status,
        "updated_at": datetime.utcnow().isoformat(),
    }

    if new_status == "active" and not campaign.get("started_at"):
        update_data["started_at"] = datetime.utcnow().isoformat()

        # Schedule initial messages when starting
        background_tasks.add_task(
            _schedule_campaign_messages,
            campaign_id=campaign_id,
        )

    if new_status == "completed":
        update_data["completed_at"] = datetime.utcnow().isoformat()

    return await db.update_campaign(campaign_id, update_data)


async def _schedule_campaign_messages(campaign_id: str) -> None:
    """Background task to schedule messages for a campaign."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign or campaign.get("status") != "active":
        return

    # Get all messages that need to be sent
    messages = await db.list_outreach_messages(
        campaign_id=campaign_id,
        status="pending",
        limit=1000,
    )

    sequence = campaign.get("sequence", [])
    now = datetime.utcnow()

    for message in messages:
        step_number = message.get("step_number", 1)
        step = next((s for s in sequence if s.get("step_number") == step_number), None)

        if not step:
            continue

        # Calculate send time based on step delay
        delay_days = step.get("delay_days", 0)
        delay_hours = step.get("delay_hours", 0)
        scheduled_for = now + timedelta(days=delay_days, hours=delay_hours)

        # Respect send_on_days (e.g., ["mon","tue","wed","thu","fri"])
        send_on_days = campaign.get("send_on_days") or []
        if send_on_days:
            day_map = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
            allowed = {day_map[d.lower()] for d in send_on_days if d.lower() in day_map}
            if allowed:
                while scheduled_for.weekday() not in allowed:
                    scheduled_for += timedelta(days=1)

        # Respect send window hours (default 9am-17pm)
        send_window = campaign.get("send_window") or {}
        start_hour = send_window.get("start_hour", 9)
        end_hour = send_window.get("end_hour", 17)
        if scheduled_for.hour < start_hour:
            scheduled_for = scheduled_for.replace(hour=start_hour, minute=0, second=0)
        elif scheduled_for.hour >= end_hour:
            scheduled_for += timedelta(days=1)
            scheduled_for = scheduled_for.replace(hour=start_hour, minute=0, second=0)

        await db.update_outreach_message(
            message["id"],
            {"scheduled_for": scheduled_for.isoformat()},
        )


# ============================================
# RECIPIENTS
# ============================================


@router.post("/{campaign_id}/recipients", response_model=dict)
async def add_recipients(
    campaign_id: str,
    request: AddCandidatesToCampaignRequest,
) -> dict[str, Any]:
    """Add sourced candidates to a campaign."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot add to completed campaign")

    sequence = campaign.get("sequence", [])
    if not sequence:
        raise HTTPException(status_code=400, detail="Campaign has no sequence defined")

    added_count = 0
    first_step = sequence[0]

    for candidate_id in request.sourced_candidate_ids:
        candidate = await db.get_sourced_candidate(candidate_id)
        if not candidate:
            continue

        # Check if message already exists for this candidate
        existing = await db.list_outreach_messages(
            campaign_id=campaign_id,
            limit=1000,
        )
        already_added = any(m.get("sourced_candidate_id") == candidate_id for m in existing)
        if already_added:
            continue

        # Create first message in sequence
        message_data = {
            "campaign_id": campaign_id,
            "sourced_candidate_id": candidate_id,
            "step_number": first_step.get("step_number", 1),
            "channel": first_step.get("channel", "email"),
            "subject_line": first_step.get("subject_line"),
            "message_body": first_step.get("message_body"),
            "status": "pending",
        }

        await db.create_outreach_message(message_data)
        added_count += 1

        # Update candidate status
        await db.update_sourced_candidate(
            candidate_id,
            {"status": "contacted"},
        )

    # Update campaign recipient count
    await db.update_campaign(
        campaign_id,
        {
            "total_recipients": campaign.get("total_recipients", 0) + added_count,
            "updated_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "added": added_count,
        "skipped": len(request.sourced_candidate_ids) - added_count,
    }


# ============================================
# MESSAGES
# ============================================


@router.get("/{campaign_id}/messages", response_model=OutreachMessageListResponse)
async def list_campaign_messages(
    campaign_id: str,
    status: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    """List all messages in a campaign."""
    messages = await db.list_outreach_messages(
        campaign_id=campaign_id,
        status=status,
        limit=limit,
    )
    return {
        "total": len(messages),
        "messages": messages,
    }


@router.post("/{campaign_id}/send", response_model=dict)
async def send_pending_messages(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    limit: int = 50,
) -> dict[str, Any]:
    """Send pending messages for a campaign."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") != "active":
        raise HTTPException(status_code=400, detail="Campaign is not active")

    # Get pending messages
    messages = await db.list_outreach_messages(
        campaign_id=campaign_id,
        status="pending",
        limit=limit,
    )

    # Filter to messages that are ready to send
    now = datetime.utcnow()
    ready_messages = [
        m
        for m in messages
        if not m.get("scheduled_for") or datetime.fromisoformat(m["scheduled_for"]) <= now
    ]

    # Queue messages for sending
    for message in ready_messages:
        background_tasks.add_task(
            _send_message,
            message_id=message["id"],
            campaign=campaign,
        )

    return {
        "queued": len(ready_messages),
        "pending": len(messages) - len(ready_messages),
    }


async def _send_message(message_id: str, campaign: dict[str, Any]) -> None:
    """Background task to send a single message."""
    message = await db.get_outreach_message(message_id)
    if not message or message.get("status") != "pending":
        return

    candidate = await db.get_sourced_candidate(message["sourced_candidate_id"])
    if not candidate:
        await db.update_outreach_message(
            message_id,
            {"status": "failed", "error_message": "Candidate not found"},
        )
        return

    # Skip if no email
    email = candidate.get("email")
    if not email:
        await db.update_outreach_message(
            message_id,
            {"status": "failed", "error_message": "No email address"},
        )
        return

    # Get job data for the campaign
    job = await db.get_job(campaign.get("job_id")) if campaign.get("job_id") else None

    # Personalize message body
    personalization_data = {
        "first_name": candidate.get("first_name", ""),
        "last_name": candidate.get("last_name", ""),
        "full_name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
        "company": candidate.get("current_company", "your company"),
        "title": candidate.get("current_title", "your role"),
    }

    subject = email_service.personalize_template(
        message.get("subject_line", "Opportunity"),
        personalization_data,
    )

    # Personalize the message body content
    raw_body = email_service.personalize_template(
        message.get("message_body", ""),
        personalization_data,
    )

    # Build the unsubscribe URL (should be unique per recipient)
    unsubscribe_url = f"{settings.app_url}/unsubscribe?candidate={message['sourced_candidate_id']}&campaign={campaign['id']}"

    # Prepare context for HTML template
    email_context = {
        "subject": subject,
        "first_name": candidate.get("first_name", "there"),
        "last_name": candidate.get("last_name", ""),
        "message_body": raw_body,
        "job_title": job.get("title", "") if job else "",
        "location": job.get("location", "") if job else "",
        "job_type": job.get("employment_type", "") if job else "",
        "salary_range": None,  # Could format from job.salary_range if present
        "company_name": settings.app_name,
        "company_logo_url": None,  # Can be configured
        "company_address": None,  # Can be configured
        "sender_name": campaign.get("sender_name", settings.resend_from_name),
        "sender_email": campaign.get("sender_email", settings.resend_from_email),
        "sender_title": campaign.get("sender_title"),
        "sender_phone": campaign.get("sender_phone"),
        "sender_linkedin": campaign.get("sender_linkedin"),
        "cta_url": campaign.get("cta_url"),
        "cta_text": campaign.get("cta_text", "Learn More"),
        "closing": campaign.get("closing_line"),
        "unsubscribe_url": unsubscribe_url,
        "preferences_url": f"{settings.app_url}/email-preferences?candidate={message['sourced_candidate_id']}",
    }

    # Render the HTML template
    html_content = render_template("emails/campaign_outreach.html", email_context)

    try:
        result = await email_service.send_email(
            to_email=email,
            to_name=personalization_data["full_name"],
            subject=subject,
            html_content=html_content,
            from_email=campaign.get("sender_email"),
            from_name=campaign.get("sender_name"),
            reply_to=campaign.get("reply_to_email"),
            custom_args={
                "message_id": message_id,
                "campaign_id": campaign["id"],
                "sourced_candidate_id": message["sourced_candidate_id"],
                "type": "campaign_outreach",
            },
        )

        if not result.get("success"):
            logger.error(f"Failed to send campaign message {message_id}: {result}")
            await db.update_outreach_message(
                message_id,
                {"status": "failed", "error_message": "Email service returned failure"},
            )
            return

        await db.update_outreach_message(
            message_id,
            {
                "status": "sent",
                "sent_at": datetime.utcnow().isoformat(),
                "personalized_body": raw_body,
                "provider_message_id": result.get("message_id"),
            },
        )

        # Update campaign stats
        await db.update_campaign(
            campaign["id"],
            {
                "messages_sent": campaign.get("messages_sent", 0) + 1,
                "updated_at": datetime.utcnow().isoformat(),
            },
        )

        logger.info(f"Campaign message {message_id} sent to {email}")

    except Exception as e:
        logger.error(f"Error sending campaign message {message_id}: {e}")
        await db.update_outreach_message(
            message_id,
            {
                "status": "failed",
                "error_message": str(e),
            },
        )


@router.post("/messages/{message_id}/retry", response_model=dict)
async def retry_message(
    message_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Retry sending a failed message."""
    message = await db.get_outreach_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.get("status") not in ["failed", "bounced"]:
        raise HTTPException(status_code=400, detail="Can only retry failed messages")

    campaign = await db.get_campaign(message["campaign_id"])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Reset status
    await db.update_outreach_message(
        message_id,
        {"status": "pending", "error_message": None},
    )

    background_tasks.add_task(_send_message, message_id, campaign)

    return {"status": "retry_queued", "message_id": message_id}


def _compute_step_breakdown(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate message stats by step number."""
    steps: dict[int, dict[str, int]] = {}
    for msg in messages:
        step = msg.get("step_number", 1)
        if step not in steps:
            steps[step] = {"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "replied": 0, "bounced": 0}
        status = msg.get("status", "pending")
        if status in steps[step]:
            steps[step][status] += 1
        elif status in ("sent", "pending"):
            steps[step]["sent"] += 1

    return [
        {"step_number": step_num, **counts}
        for step_num, counts in sorted(steps.items())
    ]


# ============================================
# STATISTICS
# ============================================


@router.get("/{campaign_id}/stats", response_model=CampaignStatsResponse)
async def get_campaign_stats(campaign_id: str) -> dict[str, Any]:
    """Get detailed statistics for a campaign."""
    campaign = await db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    messages = await db.list_outreach_messages(
        campaign_id=campaign_id,
        limit=10000,
    )

    # Count by status
    stats = {
        "pending": 0,
        "sent": 0,
        "delivered": 0,
        "opened": 0,
        "clicked": 0,
        "replied": 0,
        "bounced": 0,
        "failed": 0,
    }

    for msg in messages:
        status = msg.get("status", "pending")
        if status in stats:
            stats[status] += 1

    total = len(messages)
    delivered = stats["delivered"] + stats["opened"] + stats["clicked"] + stats["replied"]
    sent = stats["sent"] + delivered

    return {
        "campaign_id": campaign_id,
        "total_recipients": total,
        **stats,
        "open_rate": (stats["opened"] + stats["clicked"] + stats["replied"]) / delivered * 100
        if delivered > 0
        else 0,
        "click_rate": (stats["clicked"] + stats["replied"])
        / (stats["opened"] + stats["clicked"] + stats["replied"])
        * 100
        if stats["opened"] > 0
        else 0,
        "reply_rate": stats["replied"] / delivered * 100 if delivered > 0 else 0,
        "bounce_rate": stats["bounced"] / sent * 100 if sent > 0 else 0,
        "by_step": _compute_step_breakdown(messages),
    }


# ============================================
# WEBHOOKS
# ============================================


@router.post("/webhook/resend")
async def resend_webhook(request: Request) -> dict[str, Any]:
    """
    Handle Resend webhook events (opens, clicks, bounces, etc.).

    Resend sends events with headers that we set when sending,
    allowing us to track message_id and campaign_id.
    """
    try:
        events = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Resend webhook payload: {e}")
        return {"status": "error", "message": "Invalid JSON payload"}

    # Resend sends a single event, not an array - normalize
    if isinstance(events, dict):
        events = [events]

    processed_count = 0

    for event_data in events:
        try:
            event = resend_webhook_handler.parse_event(event_data)

            # Try to find message by custom args first (more reliable)
            custom_args = event.get("custom_args", {})
            message_id = custom_args.get("message_id")

            message = None
            if message_id:
                message = await db.get_outreach_message(message_id)

            # Fall back to provider message ID
            if not message:
                provider_id = event.get("message_id")
                if provider_id:
                    message = await db.get_outreach_message_by_provider_id(provider_id)

            if not message:
                # This might be from a non-campaign email (offer, assessment, etc.)
                # Log but don't fail
                logger.debug(f"No outreach message found for event: {event}")
                continue

            # Update message based on event type
            event_type = event.get("event_type")
            update_data = {"updated_at": datetime.utcnow().isoformat()}

            if event_type == "delivered":
                update_data["status"] = "delivered"
                update_data["delivered_at"] = datetime.utcnow().isoformat()

            elif event_type == "open":
                # Only update to opened if not already clicked/replied
                current_status = message.get("status")
                if current_status not in ["clicked", "replied"]:
                    update_data["status"] = "opened"
                update_data["opened_at"] = datetime.utcnow().isoformat()

                # Update campaign stats (only count first open)
                if not message.get("opened_at"):
                    campaign = await db.get_campaign(message["campaign_id"])
                    if campaign:
                        await db.update_campaign(
                            campaign["id"],
                            {"messages_opened": campaign.get("messages_opened", 0) + 1},
                        )

            elif event_type == "click":
                # Only update to clicked if not already replied
                current_status = message.get("status")
                if current_status != "replied":
                    update_data["status"] = "clicked"
                update_data["clicked_at"] = datetime.utcnow().isoformat()
                update_data["clicked_url"] = event.get("url")

                # Update campaign stats (only count first click)
                if not message.get("clicked_at"):
                    campaign = await db.get_campaign(message["campaign_id"])
                    if campaign:
                        await db.update_campaign(
                            campaign["id"],
                            {"messages_clicked": campaign.get("messages_clicked", 0) + 1},
                        )

            elif event_type in ["bounce", "dropped", "blocked"]:
                update_data["status"] = "bounced"
                update_data["error_message"] = event.get("reason")
                update_data["bounce_type"] = event.get("bounce_type")

            elif event_type == "spamreport":
                update_data["status"] = "spam_reported"
                update_data["spam_reported_at"] = datetime.utcnow().isoformat()
                logger.warning(f"Spam report for message {message['id']}: {event}")

            elif event_type == "unsubscribe":
                update_data["unsubscribed_at"] = datetime.utcnow().isoformat()
                # Mark candidate as unsubscribed
                candidate_id = message.get("sourced_candidate_id")
                if candidate_id:
                    await db.update_sourced_candidate(
                        candidate_id,
                        {
                            "email_unsubscribed": True,
                            "email_unsubscribed_at": datetime.utcnow().isoformat(),
                        },
                    )

            await db.update_outreach_message(message["id"], update_data)
            processed_count += 1

        except Exception as e:
            logger.error(f"Error processing Resend webhook event: {e}, event: {event_data}")
            continue

    logger.info(f"Processed {processed_count} Resend webhook events")
    return {"status": "processed", "events_processed": processed_count}
