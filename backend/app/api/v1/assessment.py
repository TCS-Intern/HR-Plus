"""Assessment API endpoints."""

import secrets
from datetime import datetime, timedelta
from uuid import UUID
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.schemas.assessment import (
    AssessmentQuestionsResponse,
    AssessmentAnalysisResponse,
    AssessmentScheduleRequest,
    AssessmentQuestion,
)
from app.agents.coordinator import agent_coordinator
from app.services.supabase import db
from app.services.storage import storage

router = APIRouter()


def generate_access_token() -> str:
    """Generate a secure random access token."""
    return secrets.token_urlsafe(32)


@router.post("/generate-questions")
async def generate_questions(application_id: str) -> dict[str, Any]:
    """Generate assessment questions for a candidate."""
    # Get application with candidate data
    application = await db.get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Get job data
    job = await db.get_job(application["job_id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get candidate data
    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Run the assessor questions agent
    try:
        result = await agent_coordinator.run_assessor_questions(
            job_id=application["job_id"],
            candidate_id=application["candidate_id"],
        )

        questions = result.get("questions", [])
        instructions = result.get("instructions", {})

        # Generate access token for candidate
        access_token = generate_access_token()
        token_expires = datetime.utcnow() + timedelta(days=7)

        # Create assessment record
        assessment_data = {
            "application_id": application_id,
            "assessment_type": "video",
            "questions": questions,
            "status": "pending",
            "access_token": access_token,
            "token_expires_at": token_expires.isoformat(),
            "scheduled_duration_minutes": len(questions) * 3,  # 3 mins per question
        }

        assessment = await db.create_assessment(assessment_data)

        # Update application status
        await db.update_application(application_id, {"status": "assessment"})

        return {
            "assessment_id": assessment.get("id"),
            "access_token": access_token,
            "token_expires_at": token_expires.isoformat(),
            "questions": questions,
            "instructions": instructions,
            "candidate_assessment_url": f"/assess/{access_token}",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")


@router.post("/schedule")
async def schedule_assessment(request: AssessmentScheduleRequest) -> dict[str, Any]:
    """Schedule an assessment for a candidate."""
    # Get or create assessment
    application = await db.get_application(str(request.application_id))
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Get existing assessment or create one
    assessments_result = db.client.table("assessments").select("*").eq("application_id", str(request.application_id)).execute()
    assessment = assessments_result.data[0] if assessments_result.data else None

    if not assessment:
        # Generate questions first
        questions_result = await generate_questions(str(request.application_id))
        assessment_id = questions_result["assessment_id"]
    else:
        assessment_id = assessment["id"]

    # Update with scheduling info
    scheduled_at = request.preferred_times[0] if request.preferred_times else datetime.utcnow()

    update_data = {
        "status": "scheduled",
        "scheduled_at": scheduled_at.isoformat() if hasattr(scheduled_at, 'isoformat') else str(scheduled_at),
        "scheduled_duration_minutes": request.duration_minutes,
    }

    await db.update_assessment(assessment_id, update_data)

    # TODO: Send email invitation to candidate
    # await send_assessment_invitation(request.candidate_email, assessment_id)

    return {
        "status": "scheduled",
        "assessment_id": assessment_id,
        "scheduled_at": update_data["scheduled_at"],
        "duration_minutes": request.duration_minutes,
    }


@router.get("/token/{token}")
async def get_assessment_by_token(token: str) -> dict[str, Any]:
    """Get assessment by access token (for candidate view)."""
    assessment = await db.get_assessment_by_token(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found or expired")

    # Check if token is expired
    token_expires = assessment.get("token_expires_at")
    if token_expires:
        expires_dt = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_dt.replace(tzinfo=None):
            raise HTTPException(status_code=401, detail="Assessment link has expired")

    # Get related data
    application = await db.get_application(assessment["application_id"])
    job = await db.get_job(application["job_id"]) if application else None
    candidate = await db.get_candidate(application["candidate_id"]) if application else None

    return {
        "assessment_id": assessment["id"],
        "status": assessment.get("status"),
        "questions": assessment.get("questions", []),
        "duration_minutes": assessment.get("scheduled_duration_minutes", 30),
        "job_title": job.get("title") if job else None,
        "candidate_name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip() if candidate else None,
    }


@router.post("/submit-video")
async def submit_video(
    assessment_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Submit recorded video for assessment."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are allowed")

    # Verify assessment exists
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Read file content
    content = await file.read()

    # Upload to storage
    try:
        video_path = await storage.upload_video(
            file=content,
            filename=file.filename,
            content_type=file.content_type or "video/webm",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")

    # Update assessment with video URL
    await db.update_assessment(
        assessment_id,
        {
            "video_url": video_path,
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
        },
    )

    # Trigger video analysis asynchronously
    try:
        await analyze_video_async(assessment_id, video_path, assessment.get("questions", []))
    except Exception as e:
        print(f"Video analysis error: {e}")
        # Don't fail the request if analysis fails - it can be retried

    return {
        "status": "video_uploaded",
        "assessment_id": assessment_id,
        "video_url": video_path,
    }


async def analyze_video_async(assessment_id: str, video_url: str, questions: list) -> None:
    """Run video analysis asynchronously."""
    # Get assessment and related job data
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        return

    application = await db.get_application(assessment["application_id"])
    if not application:
        return

    job = await db.get_job(application["job_id"])
    if not job:
        return

    # Run the video analysis agent
    try:
        result = await agent_coordinator.run_video_analysis(
            video_url=video_url,
            questions=questions,
            job_requirements={
                "title": job.get("title"),
                "skills_matrix": job.get("skills_matrix"),
                "evaluation_criteria": job.get("evaluation_criteria"),
            },
        )

        # Update assessment with analysis results
        await db.update_assessment(
            assessment_id,
            {
                "video_analysis": result.get("response_analysis", []),
                "overall_score": result.get("overall_score"),
                "recommendation": result.get("recommendation"),
                "confidence_level": result.get("confidence_level"),
                "response_scores": result.get("response_analysis", []),
                "summary": result.get("summary"),
                "status": "analyzed",
                "analyzed_at": datetime.utcnow().isoformat(),
            },
        )
    except Exception as e:
        print(f"Video analysis failed: {e}")
        await db.update_assessment(assessment_id, {"status": "completed"})


@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str) -> dict[str, Any]:
    """Get assessment details."""
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get related data
    application = await db.get_application(assessment["application_id"])
    candidate = await db.get_candidate(application["candidate_id"]) if application else None

    return {
        **assessment,
        "candidate": candidate,
    }


@router.get("/{assessment_id}/analysis")
async def get_analysis(assessment_id: str) -> AssessmentAnalysisResponse:
    """Get video analysis results for an assessment."""
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment.get("status") not in ["completed", "analyzed"]:
        raise HTTPException(status_code=400, detail="Assessment not yet completed")

    return AssessmentAnalysisResponse(
        assessment_id=assessment_id,
        overall_score=assessment.get("overall_score", 0),
        recommendation=assessment.get("recommendation", "MAYBE"),
        confidence_level=assessment.get("confidence_level", "medium"),
        response_analysis=assessment.get("response_scores", []),
        communication_assessment=assessment.get("video_analysis", {}).get("communication_assessment", {}),
        behavioral_assessment=assessment.get("video_analysis", {}).get("behavioral_assessment", {}),
        summary=assessment.get("summary", {}),
    )


@router.post("/{assessment_id}/approve")
async def approve_for_offer(assessment_id: str) -> dict[str, Any]:
    """Approve candidate for offer generation after assessment."""
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment.get("status") not in ["completed", "analyzed"]:
        raise HTTPException(status_code=400, detail="Assessment not yet completed")

    # Update application status
    await db.update_application(
        assessment["application_id"],
        {
            "status": "offer",
            "assessed_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "status": "approved_for_offer",
        "assessment_id": assessment_id,
        "application_id": assessment["application_id"],
    }


@router.post("/{assessment_id}/reject")
async def reject_candidate(assessment_id: str, reason: str | None = None) -> dict[str, Any]:
    """Reject candidate after assessment."""
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    update_data = {
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
    }
    if reason:
        update_data["rejection_reason"] = reason

    await db.update_application(assessment["application_id"], update_data)

    return {
        "status": "rejected",
        "assessment_id": assessment_id,
        "application_id": assessment["application_id"],
    }


@router.get("/application/{application_id}/assessments")
async def get_assessments_for_application(application_id: str) -> dict[str, Any]:
    """Get all assessments for an application."""
    result = db.client.table("assessments").select("*").eq("application_id", application_id).order("created_at", desc=True).execute()

    return {
        "application_id": application_id,
        "assessments": result.data or [],
    }
