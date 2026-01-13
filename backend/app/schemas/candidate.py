"""Candidate-related Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class SkillMatch(BaseModel):
    """Individual skill match result."""

    skill: str
    required: bool
    found: bool
    evidence: str | None = None
    proficiency_estimate: str | None = None


class MatchBreakdown(BaseModel):
    """Detailed match breakdown."""

    required_skills_match: float = 0
    nice_to_have_match: float = 0
    experience_match: float = 0
    education_match: float = 0


class ExperienceSummary(BaseModel):
    """Experience summary from CV."""

    total_years: float = 0
    relevant_years: float = 0
    key_experiences: list[str] = []


class CandidateResponse(BaseModel):
    """Schema for candidate response."""

    id: UUID | str
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    resume_url: str | None = None
    source: str = "direct"
    created_at: datetime | None = None


class ScreeningResult(BaseModel):
    """Individual screening result for a candidate."""

    candidate_id: UUID | str
    overall_score: float = 0
    match_breakdown: MatchBreakdown = MatchBreakdown()
    skill_analysis: list[SkillMatch] = []
    experience_summary: ExperienceSummary = ExperienceSummary()
    strengths: list[str] = []
    gaps: list[str] = []
    red_flags: list[str] = []
    recommendation: str = "weak_match"  # strong_match, good_match, partial_match, weak_match
    notes: str | None = None


class ScreeningResultsResponse(BaseModel):
    """Schema for screening results response."""

    job_id: UUID | str
    screening_results: list[ScreeningResult] = []
    summary: dict = {}
