"""Pydantic schemas module."""

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
from app.schemas.job import JobCreate, JobResponse, JobUpdate
from app.schemas.candidate import CandidateResponse, ScreeningResultsResponse
from app.schemas.assessment import (
    AssessmentQuestionsResponse,
    AssessmentAnalysisResponse,
    AssessmentScheduleRequest,
)
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
