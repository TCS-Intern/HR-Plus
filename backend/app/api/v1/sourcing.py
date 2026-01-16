"""Sourcing API endpoints for finding and managing sourced candidates."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.schemas.sourcing import (
    SourceSearchRequest,
    SourceSearchResponse,
    SourceCandidateCreateRequest,
    SourceCandidateUpdateRequest,
    SourcedCandidateResponse,
    SourcedCandidateListResponse,
    ScoreCandidateRequest,
    BulkScoreRequest,
    ScoreResult,
    ImportFromSearchRequest,
    SourceSearchResultItem,
    SourcePlatform,
)
from app.services.supabase import db

router = APIRouter()


# ============================================
# SEARCH & DISCOVERY
# ============================================


@router.post("/search", response_model=SourceSearchResponse)
async def search_candidates(
    request: SourceSearchRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Search for potential candidates across various platforms.

    This endpoint initiates a search for candidates matching the job requirements.
    Results can then be imported and scored.
    """
    # Get job data for search context
    job = await db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build search query from job if not provided
    query = request.query
    if not query:
        # Generate query from job title and skills
        skills = job.get("skills_matrix", {}).get("required", [])
        skill_names = [s.get("skill", s) if isinstance(s, dict) else s for s in skills[:3]]
        query = f"{job.get('title', '')} {' '.join(skill_names)}".strip()

    # For now, return empty results - actual search integration would go here
    # In production, this would call Apollo, LinkedIn API, etc.
    results: list[SourceSearchResultItem] = []

    # TODO: Implement actual platform searches
    # - LinkedIn via RapidAPI or official API
    # - GitHub via API
    # - Apollo.io for enrichment

    return {
        "job_id": request.job_id,
        "query": query,
        "platforms_searched": request.platforms,
        "total_found": len(results),
        "results": results,
        "search_metadata": {
            "location_filter": request.location,
            "experience_range": f"{request.experience_min or 0}-{request.experience_max or 'any'}",
            "skills_filter": request.skills,
        },
    }


@router.post("/import", response_model=SourcedCandidateListResponse)
async def import_from_search(
    request: ImportFromSearchRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Import candidates from search results into the sourced candidates table.
    """
    job = await db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    imported_candidates = []

    for result in request.results:
        # Check if candidate already exists (by LinkedIn URL or email)
        existing = None
        if result.profile_url:
            existing_list = await db.list_sourced_candidates(job_id=request.job_id, limit=1000)
            for ec in existing_list:
                if ec.get("linkedin_url") == result.profile_url or ec.get("source_url") == result.profile_url:
                    existing = ec
                    break

        if existing:
            imported_candidates.append(existing)
            continue

        # Create new sourced candidate
        candidate_data = {
            "job_id": request.job_id,
            "first_name": result.first_name,
            "last_name": result.last_name,
            "current_title": result.current_title,
            "current_company": result.current_company,
            "location": result.location,
            "years_experience": result.experience_years,
            "skills": result.skills,
            "source_platform": result.platform.value,
            "source_url": result.profile_url,
            "linkedin_url": result.profile_url if result.platform == SourcePlatform.LINKEDIN else None,
            "github_url": result.profile_url if result.platform == SourcePlatform.GITHUB else None,
            "raw_profile_data": result.raw_data,
            "status": "new",
        }

        candidate = await db.create_sourced_candidate(candidate_data)
        imported_candidates.append(candidate)

        # Auto-score if requested
        if request.auto_score:
            background_tasks.add_task(
                _score_candidate,
                candidate_id=candidate["id"],
                job=job,
            )

    return {
        "total": len(imported_candidates),
        "candidates": imported_candidates,
    }


# ============================================
# CRUD OPERATIONS
# ============================================


@router.post("", response_model=SourcedCandidateResponse)
async def create_sourced_candidate(
    request: SourceCandidateCreateRequest,
) -> dict[str, Any]:
    """Manually add a sourced candidate."""
    # Verify job exists
    job = await db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_data = {
        "job_id": request.job_id,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "email": request.email,
        "phone": request.phone,
        "linkedin_url": request.linkedin_url,
        "github_url": request.github_url,
        "current_title": request.current_title,
        "current_company": request.current_company,
        "location": request.location,
        "years_experience": request.years_experience,
        "skills": request.skills,
        "source_platform": request.source_platform.value,
        "notes": request.notes,
        "status": "new",
    }

    return await db.create_sourced_candidate(candidate_data)


@router.get("/{candidate_id}", response_model=SourcedCandidateResponse)
async def get_sourced_candidate(candidate_id: str) -> dict[str, Any]:
    """Get a sourced candidate by ID."""
    candidate = await db.get_sourced_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Sourced candidate not found")
    return candidate


@router.patch("/{candidate_id}", response_model=SourcedCandidateResponse)
async def update_sourced_candidate(
    candidate_id: str,
    request: SourceCandidateUpdateRequest,
) -> dict[str, Any]:
    """Update a sourced candidate."""
    candidate = await db.get_sourced_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Sourced candidate not found")

    update_data = request.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    return await db.update_sourced_candidate(candidate_id, update_data)


@router.get("/job/{job_id}", response_model=SourcedCandidateListResponse)
async def list_sourced_candidates_for_job(
    job_id: str,
    status: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    """List all sourced candidates for a job."""
    candidates = await db.list_sourced_candidates(
        job_id=job_id,
        status=status,
        limit=limit,
    )
    return {
        "total": len(candidates),
        "candidates": candidates,
    }


# ============================================
# SCORING
# ============================================


@router.post("/{candidate_id}/score", response_model=ScoreResult)
async def score_candidate(
    candidate_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Score a sourced candidate against job requirements."""
    candidate = await db.get_sourced_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Sourced candidate not found")

    job = await db.get_job(candidate["job_id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Run scoring via agent
    result = await _score_candidate(candidate_id, job)

    return result


@router.post("/bulk-score", response_model=dict)
async def bulk_score_candidates(
    request: BulkScoreRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Score multiple candidates against a job."""
    job = await db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Queue all candidates for scoring
    for candidate_id in request.candidate_ids:
        background_tasks.add_task(
            _score_candidate,
            candidate_id=candidate_id,
            job=job,
        )

    return {
        "status": "scoring_started",
        "candidates_queued": len(request.candidate_ids),
    }


async def _score_candidate(candidate_id: str, job: dict[str, Any]) -> dict[str, Any]:
    """Background task to score a candidate against job requirements."""
    from app.agents.coordinator import agent_coordinator

    candidate = await db.get_sourced_candidate(candidate_id)
    if not candidate:
        return {"error": "Candidate not found"}

    # Build candidate profile for scoring
    candidate_profile = {
        "name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
        "current_title": candidate.get("current_title"),
        "current_company": candidate.get("current_company"),
        "location": candidate.get("location"),
        "years_experience": candidate.get("years_experience"),
        "skills": candidate.get("skills", []),
    }

    try:
        # Use talent screener for scoring
        result = await agent_coordinator.run_talent_screener(
            job_data={
                "title": job.get("title"),
                "skills_matrix": job.get("skills_matrix"),
                "qualifications": job.get("qualifications"),
            },
            candidates=[candidate_profile],
        )

        # Extract score from result
        scored = result.get("scored_candidates", [{}])[0] if result.get("scored_candidates") else {}
        fit_score = scored.get("overall_score", scored.get("fit_score", 50))
        fit_reasoning = scored.get("summary", scored.get("reasoning", ""))

        # Update candidate with score
        await db.update_sourced_candidate(
            candidate_id,
            {
                "fit_score": fit_score,
                "fit_reasoning": fit_reasoning,
                "updated_at": datetime.utcnow().isoformat(),
            },
        )

        return {
            "candidate_id": candidate_id,
            "fit_score": fit_score,
            "fit_reasoning": fit_reasoning,
            "skill_matches": scored.get("skill_matches", []),
            "experience_match": scored.get("experience_match", {}),
            "location_match": scored.get("location_match", True),
            "overall_assessment": fit_reasoning,
        }

    except Exception as e:
        print(f"Scoring failed for {candidate_id}: {e}")
        return {
            "candidate_id": candidate_id,
            "fit_score": 0,
            "fit_reasoning": f"Scoring failed: {str(e)}",
            "skill_matches": [],
            "experience_match": {},
            "location_match": False,
            "overall_assessment": "Unable to score",
        }


# ============================================
# ACTIONS
# ============================================


@router.post("/{candidate_id}/convert")
async def convert_to_application(
    candidate_id: str,
) -> dict[str, Any]:
    """
    Convert a sourced candidate to an application.

    Creates a candidate record and application, linking them to the job.
    """
    sourced = await db.get_sourced_candidate(candidate_id)
    if not sourced:
        raise HTTPException(status_code=404, detail="Sourced candidate not found")

    if sourced.get("status") == "converted":
        raise HTTPException(status_code=400, detail="Candidate already converted")

    # Create candidate record
    candidate_data = {
        "email": sourced.get("email") or f"sourced_{candidate_id}@placeholder.com",
        "first_name": sourced.get("first_name"),
        "last_name": sourced.get("last_name"),
        "phone": sourced.get("phone"),
        "linkedin_url": sourced.get("linkedin_url"),
        "github_url": sourced.get("github_url"),
        "portfolio_url": sourced.get("portfolio_url"),
        "location": sourced.get("location"),
    }

    candidate = await db.upsert_candidate(candidate_data)

    # Create application
    application_data = {
        "job_id": sourced["job_id"],
        "candidate_id": candidate["id"],
        "status": "new",
        "screening_score": sourced.get("fit_score"),
        "source": "sourced",
    }

    application = await db.create_application(application_data)

    # Update sourced candidate status
    await db.update_sourced_candidate(
        candidate_id,
        {
            "status": "converted",
            "updated_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "status": "converted",
        "candidate_id": candidate["id"],
        "application_id": application["id"],
        "sourced_candidate_id": candidate_id,
    }


@router.post("/{candidate_id}/reject")
async def reject_sourced_candidate(
    candidate_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """Mark a sourced candidate as not a fit."""
    candidate = await db.get_sourced_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Sourced candidate not found")

    update_data = {
        "status": "rejected",
        "updated_at": datetime.utcnow().isoformat(),
    }
    if reason:
        update_data["notes"] = f"{candidate.get('notes', '')}\nRejected: {reason}".strip()

    await db.update_sourced_candidate(candidate_id, update_data)

    return {
        "status": "rejected",
        "candidate_id": candidate_id,
    }
