"""Assessment API endpoints."""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.agents.coordinator import agent_coordinator
from app.agents.tools.assessment_tools import analyze_full_video
from app.config import settings
from app.schemas.assessment import (
    AssessmentAnalysisResponse,
    AssessmentScheduleRequest,
)
from app.services.email import email_service
from app.services.storage import storage
from app.services.supabase import db
from app.utils.templates import render_template

logger = logging.getLogger(__name__)

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
        raise HTTPException(
            status_code=500, detail=f"Failed to generate questions: {str(e)}"
        )


@router.post("/schedule")
async def schedule_assessment(request: AssessmentScheduleRequest) -> dict[str, Any]:
    """Schedule an assessment for a candidate."""
    # Get or create assessment
    application = await db.get_application(str(request.application_id))
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Get existing assessment or create one
    assessments_result = (
        db.client.table("assessments")
        .select("*")
        .eq("application_id", str(request.application_id))
        .execute()
    )
    assessment = assessments_result.data[0] if assessments_result.data else None

    if not assessment:
        # Generate questions first
        questions_result = await generate_questions(str(request.application_id))
        assessment_id = questions_result["assessment_id"]
        access_token = questions_result["access_token"]
    else:
        assessment_id = assessment["id"]
        access_token = assessment.get("access_token")

    # Update with scheduling info
    scheduled_at = (
        request.preferred_times[0] if request.preferred_times else datetime.utcnow()
    )

    update_data = {
        "status": "scheduled",
        "scheduled_at": (
            scheduled_at.isoformat()
            if hasattr(scheduled_at, "isoformat")
            else str(scheduled_at)
        ),
        "scheduled_duration_minutes": request.duration_minutes,
    }

    await db.update_assessment(assessment_id, update_data)

    # Send email invitation to candidate
    email_sent = False
    if request.send_invitation:
        try:
            await _send_assessment_invitation_email(
                assessment_id=assessment_id,
                access_token=access_token,
            )
            email_sent = True
        except Exception as e:
            logger.error(f"Failed to send assessment invitation email: {e}")

    return {
        "status": "scheduled",
        "assessment_id": assessment_id,
        "scheduled_at": update_data["scheduled_at"],
        "duration_minutes": request.duration_minutes,
        "invitation_sent": email_sent,
    }


async def _send_assessment_invitation_email(
    assessment_id: str,
    access_token: str,
) -> dict[str, Any]:
    """Internal function to send assessment invitation email."""
    # Get assessment data
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise ValueError("Assessment not found")

    application = await db.get_application(assessment["application_id"])
    if not application:
        raise ValueError("Application not found")

    candidate = await db.get_candidate(application["candidate_id"])
    if not candidate:
        raise ValueError("Candidate not found")

    if not candidate.get("email"):
        raise ValueError("Candidate has no email address")

    job = await db.get_job(application["job_id"])

    # Calculate deadline from token expiry
    token_expires = assessment.get("token_expires_at", "")
    deadline = token_expires[:10] if token_expires else "7 days from now"

    # Count questions
    questions = assessment.get("questions", [])
    num_questions = len(questions) if questions else 5

    # Prepare email context
    candidate_name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
    assessment_url = f"{settings.app_url}/assess/{access_token}"

    email_context = {
        "candidate_name": candidate_name,
        "job_title": job.get("title", "") if job else "",
        "company_name": settings.app_name,
        "company_logo_url": None,
        "company_address": None,
        "assessment_url": assessment_url,
        "num_questions": num_questions,
        "duration_minutes": assessment.get("scheduled_duration_minutes", 15),
        "deadline": deadline,
        "max_response_time": 3,  # minutes per response
        "support_email": settings.sendgrid_from_email or "support@talentai.com",
        "sender_name": settings.sendgrid_from_name,
    }

    # Render the email template
    html_content = render_template("emails/assessment_invite.html", email_context)

    subject = f"Video Assessment Invitation: {job.get('title', 'Position')} at {settings.app_name}"

    # Send the email (or get preview if SendGrid not configured)
    result = await email_service.send_email(
        to_email=candidate["email"],
        to_name=candidate_name,
        subject=subject,
        html_content=html_content,
        custom_args={
            "assessment_id": assessment_id,
            "application_id": assessment["application_id"],
            "type": "assessment_invitation",
        },
    )

    if not result.get("success"):
        raise ValueError(f"Email send failed: {result}")

    # Update assessment with invitation info
    update_data = {
        "invitation_sent_at": datetime.utcnow().isoformat(),
        "invitation_email_id": result.get("message_id"),
    }

    # If in preview mode, store the preview data
    if result.get("preview"):
        update_data["invitation_preview"] = True
        logger.info(f"Assessment invitation preview generated for {candidate['email']} (SendGrid not configured)")
    else:
        logger.info(f"Assessment invitation sent to {candidate['email']} for assessment {assessment_id}")

    await db.update_assessment(assessment_id, update_data)

    # Add email content to result for frontend display
    result["subject"] = subject
    result["to_email"] = candidate["email"]
    result["to_name"] = candidate_name
    result["html_content"] = html_content

    return result


@router.post("/{assessment_id}/send-invitation")
async def send_assessment_invitation(assessment_id: str) -> dict[str, Any]:
    """Send or resend assessment invitation email to candidate."""
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    access_token = assessment.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="Assessment does not have an access token. Generate questions first.",
        )

    # Check if token is expired
    token_expires = assessment.get("token_expires_at")
    if token_expires:
        expires_dt = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_dt.replace(tzinfo=None):
            # Generate new token
            new_token = generate_access_token()
            new_expiry = datetime.utcnow() + timedelta(days=7)
            await db.update_assessment(
                assessment_id,
                {
                    "access_token": new_token,
                    "token_expires_at": new_expiry.isoformat(),
                },
            )
            access_token = new_token

    try:
        result = await _send_assessment_invitation_email(
            assessment_id=assessment_id,
            access_token=access_token,
        )

        response = {
            "status": "preview" if result.get("preview") else "sent",
            "assessment_id": assessment_id,
            "message_id": result.get("message_id"),
            "preview": result.get("preview", False),
        }

        # Include email content for preview display on frontend
        if result.get("preview"):
            response["email"] = {
                "to_email": result.get("to_email"),
                "to_name": result.get("to_name"),
                "subject": result.get("subject"),
                "html_content": result.get("html_content"),
            }
            response["note"] = "SendGrid not configured - email preview generated. Configure SENDGRID_API_KEY to send emails."

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending assessment invitation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send invitation email: {str(e)}",
        )



# PUBLIC ENDPOINT - No auth required (candidate-facing)
@router.get("/token/{token}")
async def get_assessment_by_token(token: str) -> dict[str, Any]:
    """Get assessment by access token (for candidate view). This is a public endpoint."""
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
    candidate = (
        await db.get_candidate(application["candidate_id"]) if application else None
    )

    return {
        "assessment_id": assessment["id"],
        "status": assessment.get("status"),
        "questions": assessment.get("questions", []),
        "duration_minutes": assessment.get("scheduled_duration_minutes", 30),
        "job_title": job.get("title") if job else None,
        "candidate_name": (
            f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
            if candidate
            else None
        ),
    }


# PUBLIC ENDPOINT - No auth required (candidate-facing video submission)
@router.post("/submit-video")
async def submit_video(
    background_tasks: BackgroundTasks,
    assessment_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Submit recorded video for assessment.

    This is a public endpoint for candidates.
    Uploads the video and triggers background analysis using Gemini Vision.
    """
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
        raise HTTPException(
            status_code=500, detail=f"Failed to upload video: {str(e)}"
        )

    # Update assessment with video URL and status
    await db.update_assessment(
        assessment_id,
        {
            "video_url": video_path,
            "status": "processing",  # Set to processing while analysis runs
            "completed_at": datetime.utcnow().isoformat(),
        },
    )

    # Trigger video analysis in background
    background_tasks.add_task(
        run_video_analysis_background,
        assessment_id,
        video_path,
        assessment.get("questions", []),
    )

    return {
        "status": "video_uploaded",
        "assessment_id": assessment_id,
        "video_url": video_path,
        "message": "Video uploaded successfully. Analysis is running in the background.",
    }


async def run_video_analysis_background(
    assessment_id: str, video_url: str, questions: list
) -> None:
    """Run video analysis as a background task.

    This function uses the Gemini Vision-based video analyzer to perform
    comprehensive analysis of the candidate's video assessment.
    """
    logger.info(f"Starting video analysis for assessment {assessment_id}")

    try:
        # Get assessment and related job data
        assessment = await db.get_assessment(assessment_id)
        if not assessment:
            logger.error(f"Assessment {assessment_id} not found")
            return

        application = await db.get_application(assessment["application_id"])
        if not application:
            logger.error(f"Application not found for assessment {assessment_id}")
            return

        job = await db.get_job(application["job_id"])
        if not job:
            logger.error(f"Job not found for assessment {assessment_id}")
            return

        # Build job context for the analysis
        job_context = f"""
Job Title: {job.get('title', 'Not specified')}
Department: {job.get('department', 'Not specified')}

Skills Matrix:
{job.get('skills_matrix', {})}

Evaluation Criteria:
{job.get('evaluation_criteria', [])}
"""

        # Run the Gemini Vision-based video analysis
        logger.info(f"Running Gemini Vision analysis for assessment {assessment_id}")

        result = await analyze_full_video(
            video_url=video_url,
            questions=questions,
            job_context=job_context,
        )

        logger.info(
            f"Video analysis completed for assessment {assessment_id}. "
            f"Score: {result.get('overall_score', 'N/A')}, "
            f"Recommendation: {result.get('recommendation', 'N/A')}"
        )

        # Extract and structure the results
        video_analysis = {
            "communication_assessment": result.get("communication_assessment", {}),
            "behavioral_assessment": result.get("behavioral_assessment", {}),
            "transcription": result.get("transcription", {}),
        }

        # Update assessment with analysis results
        await db.update_assessment(
            assessment_id,
            {
                "video_analysis": video_analysis,
                "overall_score": result.get("overall_score", 0),
                "recommendation": result.get("recommendation", "MAYBE"),
                "confidence_level": result.get("confidence_level", "medium"),
                "response_scores": result.get("response_analysis", []),
                "summary": result.get("summary", {}),
                "status": "analyzed",
                "analyzed_at": datetime.utcnow().isoformat(),
            },
        )

        logger.info(f"Assessment {assessment_id} updated with analysis results")

    except Exception as e:
        logger.error(f"Video analysis failed for assessment {assessment_id}: {e}")

        # Update status to completed (not analyzed) so it can be retried
        try:
            await db.update_assessment(
                assessment_id,
                {
                    "status": "completed",
                    "analysis_error": str(e),
                },
            )
        except Exception as update_error:
            logger.error(f"Failed to update assessment status: {update_error}")


@router.post("/{assessment_id}/reanalyze")
async def reanalyze_video(
    assessment_id: str, background_tasks: BackgroundTasks
) -> dict[str, Any]:
    """Re-run video analysis for an assessment.

    This endpoint allows re-analyzing a video if the initial analysis failed
    or if a new analysis is needed.
    """
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    video_url = assessment.get("video_url")
    if not video_url:
        raise HTTPException(status_code=400, detail="No video found for this assessment")

    # Update status to processing
    await db.update_assessment(assessment_id, {"status": "processing"})

    # Trigger re-analysis in background
    background_tasks.add_task(
        run_video_analysis_background,
        assessment_id,
        video_url,
        assessment.get("questions", []),
    )

    return {
        "status": "reanalysis_started",
        "assessment_id": assessment_id,
        "message": "Video analysis has been restarted.",
    }


@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str) -> dict[str, Any]:
    """Get assessment details."""
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get related data
    application = await db.get_application(assessment["application_id"])
    candidate = (
        await db.get_candidate(application["candidate_id"]) if application else None
    )

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

    # Get video analysis data
    video_analysis = assessment.get("video_analysis", {})

    return AssessmentAnalysisResponse(
        assessment_id=assessment_id,
        overall_score=assessment.get("overall_score", 0),
        recommendation=assessment.get("recommendation", "MAYBE"),
        confidence_level=assessment.get("confidence_level", "medium"),
        response_analysis=assessment.get("response_scores", []),
        communication_assessment=video_analysis.get("communication_assessment", {}),
        behavioral_assessment=video_analysis.get("behavioral_assessment", {}),
        summary=assessment.get("summary", {}),
    )


@router.get("/{assessment_id}/status")
async def get_analysis_status(assessment_id: str) -> dict[str, Any]:
    """Get the current status of video analysis.

    This endpoint is useful for polling the analysis status after video submission.
    """
    assessment = await db.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    status = assessment.get("status", "unknown")

    response = {
        "assessment_id": assessment_id,
        "status": status,
        "video_url": assessment.get("video_url"),
        "completed_at": assessment.get("completed_at"),
        "analyzed_at": assessment.get("analyzed_at"),
    }

    # Include analysis error if present
    if assessment.get("analysis_error"):
        response["analysis_error"] = assessment.get("analysis_error")

    # Include score summary if analyzed
    if status == "analyzed":
        response["overall_score"] = assessment.get("overall_score", 0)
        response["recommendation"] = assessment.get("recommendation", "MAYBE")

    return response


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
    result = (
        db.client.table("assessments")
        .select("*")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "application_id": application_id,
        "assessments": result.data or [],
    }
