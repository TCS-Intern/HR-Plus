"""Screening API endpoints."""

from uuid import UUID
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.schemas.candidate import CandidateResponse, ScreeningResultsResponse, ScreeningResult
from app.agents.coordinator import agent_coordinator
from app.services.supabase import db
from app.services.storage import storage
from app.services.document import document_parser

router = APIRouter()


@router.post("/start")
async def start_screening(job_id: str) -> dict[str, Any]:
    """Start screening process for a job."""
    # Verify job exists
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get all applications for this job that need screening
    applications = await db.list_applications_for_job(job_id)

    # Filter applications that haven't been screened
    unscreened = [app for app in applications if app.get("status") == "new"]

    return {
        "status": "screening_started",
        "job_id": job_id,
        "total_applications": len(applications),
        "to_screen": len(unscreened),
    }


@router.post("/upload-cv")
async def upload_cv(
    job_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload CV for screening and create application."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Check file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed")

    # Verify job exists
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Read file content
    content = await file.read()

    # Parse the resume
    try:
        parsed_data = document_parser.parse_resume(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Extract email from parsed data or generate placeholder
    email = parsed_data.get("email") or f"candidate_{hash(content) % 100000}@unknown.com"

    # Upload resume to storage
    resume_path = await storage.upload_resume(
        file=content,
        filename=file.filename,
        content_type=file.content_type or "application/pdf",
    )

    # Create or update candidate
    candidate_data = {
        "email": email,
        "first_name": parsed_data.get("sections", {}).get("name", "").split()[0] if parsed_data.get("sections", {}).get("name") else None,
        "last_name": " ".join(parsed_data.get("sections", {}).get("name", "").split()[1:]) if parsed_data.get("sections", {}).get("name") else None,
        "phone": parsed_data.get("phone"),
        "linkedin_url": parsed_data.get("linkedin"),
        "resume_url": resume_path,
        "resume_parsed": parsed_data,
        "source": "direct",
    }

    candidate = await db.upsert_candidate(candidate_data)

    # Create application
    application_data = {
        "job_id": job_id,
        "candidate_id": candidate["id"],
        "status": "screening",
    }

    # Check if application already exists
    existing_apps = await db.list_applications_for_job(job_id)
    existing_app = next(
        (app for app in existing_apps if app.get("candidate_id") == candidate["id"]),
        None,
    )

    if existing_app:
        application = existing_app
    else:
        application = await db.create_application(application_data)

    # Run the screening agent
    try:
        screening_result = await agent_coordinator.run_talent_screener(
            job_data=job,
            candidates=[{**candidate, "resume_text": parsed_data.get("raw_text", "")}],
        )

        # Parse screening result and update application
        if screening_result:
            score = screening_result.get("overall_score", 0)
            recommendation = screening_result.get("recommendation", "weak_match")

            await db.update_application(
                application["id"],
                {
                    "status": "screening",
                    "screening_score": score,
                    "screening_recommendation": recommendation,
                    "match_breakdown": screening_result.get("match_breakdown"),
                    "strengths": screening_result.get("strengths", []),
                    "gaps": screening_result.get("gaps", []),
                    "red_flags": screening_result.get("red_flags", []),
                    "screened_at": "now()",
                },
            )
    except Exception as e:
        # Log error but don't fail the upload
        print(f"Screening error: {e}")

    return {
        "candidate": candidate,
        "application_id": application.get("id"),
        "status": "uploaded_and_screening",
    }


@router.get("/{job_id}/candidates")
async def get_screened_candidates(job_id: str) -> dict[str, Any]:
    """Get screened candidates for a job."""
    # Verify job exists
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get applications with candidate data
    applications = await db.list_applications_for_job(job_id)

    # Transform to response format
    results = []
    for app in applications:
        candidate = app.get("candidates", {})
        results.append({
            "application_id": app.get("id"),
            "candidate_id": app.get("candidate_id"),
            "candidate": candidate,
            "screening_score": app.get("screening_score"),
            "screening_recommendation": app.get("screening_recommendation"),
            "match_breakdown": app.get("match_breakdown"),
            "strengths": app.get("strengths", []),
            "gaps": app.get("gaps", []),
            "red_flags": app.get("red_flags", []),
            "status": app.get("status"),
            "screened_at": app.get("screened_at"),
        })

    return {
        "job_id": job_id,
        "job_title": job.get("title"),
        "total_candidates": len(results),
        "candidates": results,
    }


@router.put("/shortlist")
async def update_shortlist(application_ids: list[str]) -> dict[str, Any]:
    """Mark selected applications as shortlisted."""
    updated = []
    for app_id in application_ids:
        try:
            await db.update_application(
                app_id,
                {
                    "status": "shortlisted",
                    "shortlisted_at": "now()",
                },
            )
            updated.append(app_id)
        except Exception as e:
            print(f"Error shortlisting {app_id}: {e}")

    return {
        "status": "shortlist_updated",
        "updated_count": len(updated),
        "application_ids": updated,
    }


@router.post("/{application_id}/reject")
async def reject_candidate(application_id: str, reason: str | None = None) -> dict[str, Any]:
    """Reject a candidate application."""
    update_data = {
        "status": "rejected",
        "rejected_at": "now()",
    }
    if reason:
        update_data["rejection_reason"] = reason

    try:
        await db.update_application(application_id, update_data)
        return {"status": "rejected", "application_id": application_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
