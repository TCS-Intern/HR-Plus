"""Pydantic schemas module."""

from app.schemas.assessment import (
    AssessmentAnalysisResponse,
    AssessmentQuestionsResponse,
    AssessmentScheduleRequest,
)
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordResetRequest,
    PasswordUpdateRequest,
    RefreshTokenRequest,
    SignupRequest,
    TokenPayload,
    User,
    UserRole,
)
from app.schemas.candidate import CandidateResponse, ScreeningResultsResponse
from app.schemas.job import JobCreate, JobResponse, JobUpdate
from app.schemas.offer import OfferCreate, OfferResponse, OfferUpdate

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "PasswordResetRequest",
    "PasswordUpdateRequest",
    "RefreshTokenRequest",
    "SignupRequest",
    "TokenPayload",
    "User",
    "UserRole",
    # Job
    "JobCreate",
    "JobResponse",
    "JobUpdate",
    # Candidate
    "CandidateResponse",
    "ScreeningResultsResponse",
    # Assessment
    "AssessmentQuestionsResponse",
    "AssessmentAnalysisResponse",
    "AssessmentScheduleRequest",
    # Offer
    "OfferCreate",
    "OfferResponse",
    "OfferUpdate",
]
