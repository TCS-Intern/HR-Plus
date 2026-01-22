"""Email API endpoints for previewing and managing emails."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from google import genai
from pydantic import BaseModel

from app.config import settings
from app.services.email import email_service
from app.services.supabase import db
from app.utils.templates import render_template

logger = logging.getLogger(__name__)

# Configure Gemini client for email personalization
gemini_client = genai.Client(api_key=settings.google_api_key)

router = APIRouter()


class EmailPreviewRequest(BaseModel):
    """Request model for email preview."""

    template: str  # "assessment_invite", "offer_letter", "campaign_outreach"
    context: dict[str, Any] = {}


@router.get("/status")
async def get_email_status() -> dict[str, Any]:
    """Get email service configuration status."""
    return email_service.get_configuration_status()


@router.post("/preview")
async def preview_email_template(request: EmailPreviewRequest) -> dict[str, Any]:
    """
    Preview an email template with given context.

    Returns the rendered HTML without sending.
    """
    template_map = {
        "assessment_invite": "emails/assessment_invite.html",
        "offer_letter": "emails/offer_letter.html",
        "campaign_outreach": "emails/campaign_outreach.html",
    }

    template_path = template_map.get(request.template)
    if not template_path:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown template: {request.template}. Available: {list(template_map.keys())}",
        )

    # Add default context values
    default_context = {
        "company_name": settings.app_name,
        "company_logo_url": None,
        "support_email": settings.sendgrid_from_email or "support@example.com",
        "sender_name": settings.sendgrid_from_name or "TalentAI",
    }
    context = {**default_context, **request.context}

    try:
        html_content = render_template(template_path, context)
        return {
            "template": request.template,
            "html_content": html_content,
            "context": context,
            "email_configured": email_service.is_configured,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render template: {e}")


@router.get("/preview/assessment/{assessment_id}")
async def preview_assessment_email(assessment_id: str) -> dict[str, Any]:
    """
    Preview the assessment invitation email for a specific assessment.

    Returns the email HTML and details without sending.
    """
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    application = await db.get_application(assessment["application_id"])
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = await db.get_job(application["job_id"])

    # Calculate deadline from token expiry
    token_expires = assessment.get("token_expires_at", "")
    deadline = token_expires[:10] if token_expires else "7 days from now"

    # Count questions
    questions = assessment.get("questions", [])
    num_questions = len(questions) if questions else 5

    # Build assessment URL
    access_token = assessment.get("access_token", "TOKEN_NOT_GENERATED")
    assessment_url = f"{settings.app_url}/assess/{access_token}"

    # Prepare email context
    candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()

    email_context = {
        "candidate_name": candidate_name or "Candidate",
        "job_title": job.get("title", "Position") if job else "Position",
        "company_name": settings.app_name,
        "company_logo_url": None,
        "company_address": None,
        "assessment_url": assessment_url,
        "num_questions": num_questions,
        "duration_minutes": assessment.get("scheduled_duration_minutes", 15),
        "deadline": deadline,
        "max_response_time": 3,
        "support_email": settings.sendgrid_from_email or "support@talentai.com",
        "sender_name": settings.sendgrid_from_name,
    }

    # Render the email template
    html_content = render_template("emails/assessment_invite.html", email_context)

    return {
        "assessment_id": assessment_id,
        "to_email": candidate.get("email", "no-email@example.com"),
        "to_name": candidate_name,
        "subject": f"Video Assessment Invitation: {job.get('title', 'Position')} at {settings.app_name}",
        "html_content": html_content,
        "context": email_context,
        "email_configured": email_service.is_configured,
        "can_send": email_service.is_configured and bool(candidate.get("email")),
    }


async def _generate_personalized_offer_content(
    candidate_name: str,
    job_title: str,
    company_name: str,
    base_salary: str,
    signing_bonus: str | None,
    candidate_context: dict[str, Any],
) -> dict[str, str]:
    """Generate AI-personalized offer email content."""

    # Build context about the candidate
    screening_score = candidate_context.get("screening_score", "N/A")
    phone_screen = candidate_context.get("phone_screen", {})
    assessment = candidate_context.get("assessment", {})

    phone_highlights = []
    if phone_screen:
        if phone_screen.get("recommendation"):
            phone_highlights.append(f"Phone screen: {phone_screen.get('recommendation')}")
        if phone_screen.get("summary", {}).get("key_takeaways"):
            phone_highlights.extend(phone_screen["summary"]["key_takeaways"][:2])

    assessment_highlights = []
    if assessment:
        if assessment.get("overall_score"):
            assessment_highlights.append(f"Assessment score: {assessment.get('overall_score')}/100")
        if assessment.get("summary", {}).get("top_strengths"):
            assessment_highlights.extend(assessment["summary"]["top_strengths"][:2])

    prompt = f"""Generate personalized content for a job offer email. Be warm, professional, and specific.

CANDIDATE: {candidate_name}
POSITION: {job_title}
COMPANY: {company_name}
BASE SALARY: ${base_salary}
SIGNING BONUS: ${signing_bonus or "None"}
SCREENING SCORE: {screening_score}

INTERVIEW HIGHLIGHTS:
{chr(10).join(f"- {h}" for h in phone_highlights) if phone_highlights else "- Strong candidate"}

ASSESSMENT HIGHLIGHTS:
{chr(10).join(f"- {h}" for h in assessment_highlights) if assessment_highlights else "- Excellent performance"}

Generate exactly 3 pieces of content in this JSON format:
{{
    "opening_paragraph": "A personalized 2-3 sentence opening that references specific things that impressed us about this candidate",
    "why_you_paragraph": "A 2-3 sentence paragraph explaining why we think they're a great fit, referencing their specific strengths",
    "closing_paragraph": "A warm 1-2 sentence closing that expresses genuine excitement about them joining"
}}

Be specific and personal - avoid generic phrases. Reference their actual strengths and performance."""

    try:
        import json
        import re

        response = gemini_client.models.generate_content(
            model=settings.gemini_model or "gemini-2.5-flash",
            contents=prompt,
        )

        # Parse JSON from response
        text = response.text
        # Extract JSON from markdown code block if present
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if json_match:
            text = json_match.group(1)

        content = json.loads(text)
        return content
    except Exception as e:
        logger.warning(f"AI personalization failed: {e}")
        # Return default content
        return {
            "opening_paragraph": f"We are thrilled to extend this offer to you for the position of {job_title} at {company_name}. Your skills, experience, and enthusiasm throughout the interview process truly impressed our team.",
            "why_you_paragraph": "We believe you would be an excellent addition to our team. Your technical abilities and professional approach align perfectly with what we're looking for in this role.",
            "closing_paragraph": "We are genuinely excited about the possibility of you joining us and look forward to your response.",
        }


@router.get("/preview/offer/{offer_id}")
async def preview_offer_email(offer_id: str, personalize: bool = True) -> dict[str, Any]:
    """
    Preview the offer letter email for a specific offer.

    Returns the email HTML and details without sending.
    Set personalize=false to skip AI personalization.
    """
    offer = await db.get_offer(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    application = await db.get_application(offer["application_id"])
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = await db.get_job(application["job_id"])

    # Gather candidate context for personalization
    candidate_context = {
        "screening_score": application.get("screening_score"),
    }

    # Get phone screen data if exists
    try:
        phone_screen = await db.get_phone_screen_by_application(application["id"])
        if phone_screen:
            candidate_context["phone_screen"] = phone_screen
    except Exception:
        pass  # Phone screen may not exist

    # Get assessment data if exists
    try:
        assessment = await db.get_assessment_by_application(application["id"])
        if assessment:
            candidate_context["assessment"] = assessment
    except Exception:
        pass  # Assessment may not exist

    # Build response URL
    response_token = offer.get("response_token", "TOKEN_NOT_GENERATED")
    response_url = f"{settings.app_url}/offer/{response_token}"

    # Prepare email context
    candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()

    # Format base salary with commas
    base_salary = offer.get("base_salary", 0)
    try:
        base_salary_formatted = f"{int(float(base_salary)):,}"
    except (ValueError, TypeError):
        base_salary_formatted = str(base_salary)

    # Format signing bonus
    signing_bonus = offer.get("signing_bonus", 0)
    try:
        signing_bonus_formatted = f"{int(float(signing_bonus)):,}" if signing_bonus else None
    except (ValueError, TypeError):
        signing_bonus_formatted = str(signing_bonus) if signing_bonus else None

    # Format benefits as readable strings
    raw_benefits = offer.get("benefits", [])
    formatted_benefits = []
    for b in raw_benefits:
        if isinstance(b, dict):
            benefit_type = b.get("benefit_type", "Benefit")
            description = b.get("description", "")
            formatted_benefits.append(f"<strong>{benefit_type}</strong>: {description}")
        else:
            formatted_benefits.append(str(b))

    # Format dates nicely
    start_date = offer.get("start_date", "TBD")
    if start_date and start_date != "TBD":
        try:
            from datetime import datetime as dt

            start_dt = dt.fromisoformat(start_date.replace("Z", "+00:00"))
            start_date = start_dt.strftime("%B %d, %Y")
        except (ValueError, TypeError):
            pass

    offer_expiry = offer.get("offer_expiry_date", "7 days from receipt")
    if offer_expiry and offer_expiry != "7 days from receipt":
        try:
            from datetime import datetime as dt

            expiry_dt = dt.fromisoformat(offer_expiry.replace("Z", "+00:00"))
            offer_expiry = expiry_dt.strftime("%B %d, %Y")
        except (ValueError, TypeError):
            pass

    # Generate AI-personalized content if requested
    personalized_content = {}
    if personalize:
        personalized_content = await _generate_personalized_offer_content(
            candidate_name=candidate_name,
            job_title=job.get("title", "Position") if job else "Position",
            company_name=settings.app_name,
            base_salary=base_salary_formatted,
            signing_bonus=signing_bonus_formatted,
            candidate_context=candidate_context,
        )

    email_context = {
        "candidate_name": candidate_name or "Candidate",
        "job_title": job.get("title", "Position") if job else "Position",
        "department": job.get("department", "") if job else "",
        "company_name": settings.app_name,
        "company_logo_url": None,
        "base_salary": base_salary_formatted,
        "signing_bonus": signing_bonus_formatted,
        "annual_bonus_target": offer.get("annual_bonus_target"),
        "equity_type": offer.get("equity_type"),
        "equity_amount": offer.get("equity_amount"),
        "equity_vesting_schedule": offer.get("equity_vesting_schedule"),
        "start_date": start_date,
        "offer_expiry_date": offer_expiry,
        "benefits": formatted_benefits,
        "contingencies": offer.get("contingencies", []),
        "response_url": response_url,
        "currency_symbol": "$",
        "currency": "USD",
        # AI-personalized content
        "opening_paragraph": personalized_content.get("opening_paragraph", ""),
        "why_you_paragraph": personalized_content.get("why_you_paragraph", ""),
        "closing_paragraph": personalized_content.get("closing_paragraph", ""),
        "is_personalized": bool(personalized_content),
    }

    # Render the email template
    html_content = render_template("emails/offer_letter.html", email_context)

    return {
        "offer_id": offer_id,
        "to_email": candidate.get("email", "no-email@example.com"),
        "to_name": candidate_name,
        "subject": f"Job Offer: {job.get('title', 'Position')} at {settings.app_name}",
        "html_content": html_content,
        "context": email_context,
        "email_configured": email_service.is_configured,
        "can_send": email_service.is_configured and bool(candidate.get("email")),
    }
