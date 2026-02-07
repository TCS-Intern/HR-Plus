"""Public API endpoints for candidate-facing apply flow."""

import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.agents.coordinator import agent_coordinator
from app.config import settings
from app.services.email import email_service
from app.services.resume_parser import resume_parser
from app.services.storage import storage
from app.services.supabase import db
from app.utils.templates import render_template

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_public_job(job_id: str) -> dict[str, Any]:
    """Get public job info. Only returns approved jobs."""
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job["id"],
        "title": job.get("title"),
        "description": job.get("description"),
        "summary": job.get("summary"),
        "department": job.get("department"),
        "location": job.get("location"),
        "job_type": job.get("job_type"),
        "remote_policy": job.get("remote_policy"),
        "skills_matrix": job.get("skills_matrix"),
        "company_name": settings.app_name,
    }


@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: str,
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),
    linkedin_url: str = Form(None),
    file: UploadFile = File(...),
    ref: str | None = Query(None),
) -> dict[str, Any]:
    """Public endpoint for candidates to apply to a job.

    Accepts multipart form data with resume file and candidate info.
    Optional `ref` query param links to a sourced candidate profile.
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed")

    # Verify job exists and is approved
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Job not found")

    # Read and parse resume
    content = await file.read()
    try:
        parsed_result = resume_parser.parse(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Upload resume to storage
    resume_path = await storage.upload_resume(
        file=content,
        filename=file.filename,
        content_type=file.content_type or "application/pdf",
    )

    # Build parsed data
    resume_parsed = {
        "raw_text": parsed_result.get("raw_text", ""),
        "contact": parsed_result.get("contact", {}),
        "summary": parsed_result.get("summary", ""),
        "experience": parsed_result.get("experience", []),
        "education": parsed_result.get("education", []),
        "skills": parsed_result.get("skills", []),
        "certifications": parsed_result.get("certifications", []),
    }

    # Upsert candidate (use form data over parsed data)
    candidate_data = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "linkedin_url": linkedin_url,
        "resume_url": resume_path,
        "resume_parsed": resume_parsed,
        "source": "public_apply",
    }

    # If ref is provided, link to sourced candidate
    if ref:
        candidate_data["sourced_candidate_id"] = ref

    candidate = await db.upsert_candidate(candidate_data)

    # Check for existing application
    existing_apps = await db.list_applications_for_job(job_id)
    existing_app = next(
        (app for app in existing_apps if app.get("candidate_id") == candidate["id"]),
        None,
    )

    if existing_app:
        application = existing_app
    else:
        application_data = {
            "job_id": job_id,
            "candidate_id": candidate["id"],
            "status": "screening",
            "source": "public_apply",
        }
        if ref:
            application_data["sourced_candidate_id"] = ref
        application = await db.create_application(application_data)

    # Run screening agent in background
    try:
        screening_result = await agent_coordinator.run_talent_screener(
            job_data=job,
            candidates=[
                {
                    **candidate,
                    "resume_text": parsed_result.get("raw_text", ""),
                    "resume_parsed": resume_parsed,
                }
            ],
        )

        if screening_result:
            # Extract first candidate result from the screening_results array
            results_list = screening_result.get("screening_results", [])
            candidate_result = results_list[0] if results_list else screening_result

            score = candidate_result.get("overall_score", 0)
            recommendation = candidate_result.get("recommendation", "weak_match")

            await db.update_application(
                application["id"],
                {
                    "status": "screening",
                    "screening_score": score,
                    "screening_recommendation": recommendation,
                    "match_breakdown": candidate_result.get("match_breakdown"),
                    "strengths": candidate_result.get("strengths", []),
                    "gaps": candidate_result.get("gaps", []),
                    "red_flags": candidate_result.get("red_flags", []),
                    "screened_at": "now()",
                },
            )
    except Exception as e:
        logger.error(f"Screening error for public apply: {e}", exc_info=True)

    # Send confirmation email
    candidate_name = f"{first_name} {last_name}".strip()
    try:
        html_content = render_template(
            "emails/application_received.html",
            {
                "candidate_name": candidate_name,
                "job_title": job.get("title", ""),
                "company_name": settings.app_name,
            },
        )

        await email_service.send_email(
            to_email=email,
            to_name=candidate_name,
            subject=f"Application Received: {job.get('title', 'Position')} at {settings.app_name}",
            html_content=html_content,
        )
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {e}")

    return {
        "success": True,
        "application_id": application.get("id"),
        "message": "Application received successfully",
    }
