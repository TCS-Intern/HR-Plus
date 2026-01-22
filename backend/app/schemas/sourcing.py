"""Sourcing related Pydantic schemas."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

# ============================================
# ENUMS
# ============================================


class SourcedCandidateStatus(str, Enum):
    """Status of a sourced candidate."""
    NEW = "new"
    CONTACTED = "contacted"
    REPLIED = "replied"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    CONVERTED = "converted"  # Became an application
    REJECTED = "rejected"


class SourcePlatform(str, Enum):
    """Source platform for candidate."""
    LINKEDIN = "linkedin"
    GITHUB = "github"
    INDEED = "indeed"
    GLASSDOOR = "glassdoor"
    ANGELIST = "angelist"
    MANUAL = "manual"
    OTHER = "other"


# ============================================
# REQUEST SCHEMAS
# ============================================


class SourceSearchRequest(BaseModel):
    """Request to search for candidates."""

    job_id: str = Field(..., description="Job ID to source for")
    query: str | None = Field(None, description="Search query/keywords")
    platforms: list[SourcePlatform] = Field(
        default=[SourcePlatform.LINKEDIN],
        description="Platforms to search"
    )
    location: str | None = Field(None, description="Location filter")
    experience_min: int | None = Field(None, description="Minimum years of experience")
    experience_max: int | None = Field(None, description="Maximum years of experience")
    skills: list[str] = Field(default_factory=list, description="Required skills")
    limit: int = Field(default=50, ge=1, le=200, description="Max candidates to return")


class SourceCandidateCreateRequest(BaseModel):
    """Request to manually add a sourced candidate."""

    job_id: str = Field(..., description="Job ID")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    email: str | None = Field(None, description="Email address")
    phone: str | None = Field(None, description="Phone number")
    linkedin_url: str | None = Field(None, description="LinkedIn profile URL")
    github_url: str | None = Field(None, description="GitHub profile URL")
    current_title: str | None = Field(None, description="Current job title")
    current_company: str | None = Field(None, description="Current company")
    location: str | None = Field(None, description="Location")
    years_experience: int | None = Field(None, description="Years of experience")
    skills: list[str] = Field(default_factory=list, description="Known skills")
    source_platform: SourcePlatform = Field(default=SourcePlatform.MANUAL)
    notes: str | None = Field(None, description="Recruiter notes")


class SourceCandidateUpdateRequest(BaseModel):
    """Request to update a sourced candidate."""

    status: SourcedCandidateStatus | None = None
    email: str | None = None
    phone: str | None = None
    fit_score: float | None = None
    notes: str | None = None


class ScoreCandidateRequest(BaseModel):
    """Request to score a sourced candidate against a job."""

    candidate_id: str = Field(..., description="Sourced candidate ID")


class BulkScoreRequest(BaseModel):
    """Request to score multiple candidates."""

    candidate_ids: list[str] = Field(..., description="List of candidate IDs to score")
    job_id: str = Field(..., description="Job ID to score against")


# ============================================
# RESPONSE SCHEMAS
# ============================================


class SourcedCandidateResponse(BaseModel):
    """Response for a sourced candidate."""

    id: str
    job_id: str

    # Personal info
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None

    # Professional info
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    current_title: str | None = None
    current_company: str | None = None
    location: str | None = None
    years_experience: int | None = None

    # Skills and scoring
    skills: list[str] = Field(default_factory=list)
    fit_score: float | None = None
    fit_reasoning: str | None = None

    # Source info
    source_platform: str
    source_url: str | None = None
    raw_profile_data: dict[str, Any] | None = None

    # Status tracking
    status: str = "new"
    notes: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SourcedCandidateListResponse(BaseModel):
    """Response for listing sourced candidates."""

    total: int
    candidates: list[SourcedCandidateResponse]


class ScoreResult(BaseModel):
    """Result of scoring a candidate."""

    candidate_id: str
    fit_score: float = Field(ge=0, le=100)
    fit_reasoning: str
    skill_matches: list[dict[str, Any]]
    experience_match: dict[str, Any]
    location_match: bool
    overall_assessment: str


class SourceSearchResultItem(BaseModel):
    """A single search result from sourcing."""

    platform: SourcePlatform
    profile_url: str
    first_name: str
    last_name: str
    headline: str | None = None
    current_company: str | None = None
    current_title: str | None = None
    location: str | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience_years: int | None = None
    raw_data: dict[str, Any] | None = None


class SourceSearchResponse(BaseModel):
    """Response from a sourcing search."""

    job_id: str
    query: str
    platforms_searched: list[SourcePlatform]
    total_found: int
    results: list[SourceSearchResultItem]
    search_metadata: dict[str, Any] | None = None


class ImportFromSearchRequest(BaseModel):
    """Request to import candidates from search results."""

    job_id: str = Field(..., description="Job ID to import for")
    results: list[SourceSearchResultItem] = Field(..., description="Search results to import")
    auto_score: bool = Field(default=True, description="Automatically score imported candidates")
