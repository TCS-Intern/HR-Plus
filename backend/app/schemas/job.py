"""Job-related Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SkillItem(BaseModel):
    """Individual skill in skills matrix."""

    skill: str
    proficiency: str = "intermediate"  # basic, intermediate, advanced, expert
    weight: float = Field(default=1.0, ge=0, le=1)


class SkillsMatrix(BaseModel):
    """Skills matrix for job requirements."""

    required: list[SkillItem] = []
    nice_to_have: list[SkillItem] = []


class EvaluationCriterion(BaseModel):
    """Evaluation criterion for candidate assessment."""

    criterion: str
    weight: int = Field(default=25, ge=0, le=100)
    description: str = ""
    assessment_method: str = "interview"  # interview, technical, behavioral, portfolio


class SalaryRange(BaseModel):
    """Salary range for the job."""

    min: float | None = None
    max: float | None = None
    currency: str = "USD"


class Qualifications(BaseModel):
    """Job qualifications."""

    required: list[str] = []
    preferred: list[str] = []


class SuggestedQuestions(BaseModel):
    """Suggested interview questions."""

    technical: list[str] = []
    behavioral: list[str] = []
    situational: list[str] = []


class JobCreate(BaseModel):
    """Schema for creating a job description."""

    input_type: str = "text"  # voice, text, document
    input_text: str | None = None  # Text input
    voice_transcript: str | None = None  # Voice transcript
    content: str | None = None  # Legacy field
    document_url: str | None = None
    department: str | None = None
    hiring_manager: str | None = None
    urgency: str = "normal"  # normal, urgent

    @property
    def effective_content(self) -> str:
        """Get the actual content to process."""
        return self.input_text or self.voice_transcript or self.content or ""


class JobUpdate(BaseModel):
    """Schema for updating a job description."""

    title: str | None = None
    department: str | None = None
    location: str | None = None
    job_type: str | None = None
    remote_policy: str | None = None
    summary: str | None = None
    description: str | None = None
    responsibilities: list[str] | None = None
    qualifications: Qualifications | None = None
    skills_matrix: SkillsMatrix | None = None
    evaluation_criteria: list[EvaluationCriterion] | None = None
    salary_range: SalaryRange | None = None
    status: str | None = None


class JobResponse(BaseModel):
    """Schema for job description response."""

    id: UUID | str
    title: str
    department: str | None = None
    location: str | None = None
    job_type: str = "full-time"
    remote_policy: str = "hybrid"
    summary: str | None = None
    description: str | None = None
    responsibilities: list[str] = []
    qualifications: Qualifications = Qualifications()
    skills_matrix: SkillsMatrix = SkillsMatrix()
    evaluation_criteria: list[EvaluationCriterion] = []
    suggested_questions: SuggestedQuestions = SuggestedQuestions()
    salary_range: SalaryRange = SalaryRange()
    status: str = "draft"
    created_at: datetime | None = None
    updated_at: datetime | None = None
