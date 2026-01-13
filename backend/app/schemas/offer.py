"""Offer-related Pydantic schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class Equity(BaseModel):
    """Equity compensation details."""

    type: str = "none"  # options, rsu, none
    amount: float = 0
    vesting_schedule: str = ""
    cliff_months: int = 12


class Compensation(BaseModel):
    """Full compensation package."""

    base_salary: float
    currency: str = "USD"
    pay_frequency: str = "annual"  # annual, monthly
    signing_bonus: float = 0
    annual_bonus_target: float = 0  # percentage
    equity: Equity = Equity()


class Benefit(BaseModel):
    """Individual benefit item."""

    benefit_type: str
    description: str
    value_estimate: float | None = None


class SalaryFlexibility(BaseModel):
    """Salary negotiation flexibility."""

    min: float
    max: float


class NegotiationGuidance(BaseModel):
    """Guidance for offer negotiation."""

    salary_flexibility: SalaryFlexibility | None = None
    other_levers: list[str] = []
    walk_away_point: str = ""


class OnboardingTask(BaseModel):
    """Onboarding checklist task."""

    task: str
    owner: str  # hr, manager, it, candidate
    due_before_start: bool = True


class OfferCreate(BaseModel):
    """Schema for creating an offer."""

    application_id: UUID | str
    candidate_name: str
    candidate_email: str
    job_title: str
    department: str
    salary_range_min: float
    salary_range_max: float
    experience_years: float
    assessment_score: float


class OfferUpdate(BaseModel):
    """Schema for updating an offer."""

    base_salary: float | None = None
    signing_bonus: float | None = None
    annual_bonus_target: float | None = None
    equity: Equity | None = None
    benefits: list[Benefit] | None = None
    start_date: date | None = None
    status: str | None = None


class OfferLetterContent(BaseModel):
    """Offer letter content."""

    content: str
    format: str = "html"  # html, pdf


class OfferResponse(BaseModel):
    """Response schema for offer."""

    id: UUID | str
    application_id: UUID | str
    compensation: Compensation
    benefits: list[Benefit] = []
    start_date: date | None = None
    offer_expiry: date | None = None
    contingencies: list[str] = []
    offer_letter: OfferLetterContent | None = None
    negotiation_guidance: NegotiationGuidance | None = None
    onboarding_checklist: list[OnboardingTask] = []
    status: str = "draft"
    created_at: datetime | None = None
