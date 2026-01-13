"""JD Assist API endpoints."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.schemas.job import JobCreate, JobResponse, JobUpdate
from app.agents.coordinator import agent_coordinator
from app.services.supabase import db

router = APIRouter()


def _parse_agent_response(result: dict[str, Any]) -> dict[str, Any]:
    """Parse the agent response and extract job data."""
    # Handle both direct job data and nested response
    if "response" in result and isinstance(result["response"], dict):
        return result["response"]
    return result


def _prepare_job_for_db(job_data: dict[str, Any]) -> dict[str, Any]:
    """Prepare job data for database insertion."""
    # Remove fields that don't exist in the database
    db_fields = {
        "title", "department", "location", "job_type", "remote_policy",
        "summary", "description", "responsibilities", "qualifications",
        "skills_matrix", "evaluation_criteria", "suggested_questions",
        "salary_range", "status", "created_by", "approved_by", "approved_at"
    }
    return {k: v for k, v in job_data.items() if k in db_fields and v is not None}


@router.post("/create", response_model=JobResponse)
async def create_jd(job_input: JobCreate) -> JobResponse:
    """Create a job description from voice/text input using JD Assist Agent."""
    # Run the JD Assist agent
    agent_result = await agent_coordinator.run_jd_assist(job_input.model_dump())

    # Parse the agent response
    job_data = _parse_agent_response(agent_result)

    # Ensure we have a title
    if not job_data.get("title"):
        job_data["title"] = "Untitled Position"

    # Prepare data for database
    db_data = _prepare_job_for_db(job_data)
    db_data["status"] = "draft"

    # Save to database
    try:
        saved_job = await db.create_job(db_data)
        # Merge agent data with saved job (saved job has the id and timestamps)
        response_data = {**job_data, **saved_job}
        return JobResponse(**response_data)
    except Exception as e:
        # If database save fails, still return the generated JD
        # but include a generated ID
        import uuid
        job_data["id"] = str(uuid.uuid4())
        job_data["status"] = "draft"
        return JobResponse(**job_data)


@router.get("", response_model=list[JobResponse])
async def list_jobs(status: str | None = None, limit: int = 50) -> list[JobResponse]:
    """List all jobs with optional status filter."""
    jobs = await db.list_jobs(status=status, limit=limit)
    return [JobResponse(**job) for job in jobs]


@router.get("/{job_id}", response_model=JobResponse)
async def get_jd(job_id: UUID) -> JobResponse:
    """Get job description by ID."""
    job = await db.get_job(str(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(**job)


@router.put("/{job_id}", response_model=JobResponse)
async def update_jd(job_id: UUID, job_update: JobUpdate) -> JobResponse:
    """Update a job description."""
    # Check if job exists
    existing_job = await db.get_job(str(job_id))
    if not existing_job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Prepare update data
    update_data = job_update.model_dump(exclude_unset=True, exclude_none=True)

    # Convert nested Pydantic models to dicts
    for key in ["qualifications", "skills_matrix", "salary_range"]:
        if key in update_data and hasattr(update_data[key], "model_dump"):
            update_data[key] = update_data[key].model_dump()

    if "evaluation_criteria" in update_data:
        update_data["evaluation_criteria"] = [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in update_data["evaluation_criteria"]
        ]

    # Update in database
    updated_job = await db.update_job(str(job_id), update_data)
    if not updated_job:
        raise HTTPException(status_code=500, detail="Failed to update job")

    return JobResponse(**updated_job)


@router.post("/{job_id}/approve", response_model=JobResponse)
async def approve_jd(job_id: UUID) -> JobResponse:
    """Approve a job description and set it to active status."""
    # Check if job exists
    existing_job = await db.get_job(str(job_id))
    if not existing_job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if already approved
    if existing_job.get("status") == "active":
        raise HTTPException(status_code=400, detail="Job is already active")

    # Update status to active and set approval timestamp
    from datetime import datetime
    update_data = {
        "status": "active",
        "approved_at": datetime.utcnow().isoformat(),
    }

    updated_job = await db.update_job(str(job_id), update_data)
    if not updated_job:
        raise HTTPException(status_code=500, detail="Failed to approve job")

    return JobResponse(**updated_job)


@router.post("/{job_id}/close", response_model=JobResponse)
async def close_jd(job_id: UUID, filled: bool = False) -> JobResponse:
    """Close a job (either filled or just closed)."""
    existing_job = await db.get_job(str(job_id))
    if not existing_job:
        raise HTTPException(status_code=404, detail="Job not found")

    new_status = "filled" if filled else "closed"
    updated_job = await db.update_job(str(job_id), {"status": new_status})
    if not updated_job:
        raise HTTPException(status_code=500, detail="Failed to close job")

    return JobResponse(**updated_job)
