"""Authentication schemas for user and token data."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    """User roles for role-based access control."""

    ADMIN = "admin"
    RECRUITER = "recruiter"
    HIRING_MANAGER = "hiring_manager"
    INTERVIEWER = "interviewer"
    VIEWER = "viewer"


class TokenPayload(BaseModel):
    """Payload extracted from Supabase JWT token."""

    sub: str | None = Field(None, description="User ID (subject)")
    email: str | None = Field(None, description="User email")
    role: str = Field("authenticated", description="Supabase role")
    exp: int | None = Field(None, description="Token expiration timestamp")
    aud: str | None = Field(None, description="Token audience")
    app_metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Application-specific metadata (role, company_id, etc.)",
    )
    user_metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="User-specific metadata (full_name, avatar, etc.)",
    )


class User(BaseModel):
    """Authenticated user model."""

    id: str = Field(..., description="User ID from Supabase auth")
    email: str = Field(..., description="User email address")
    role: UserRole = Field(UserRole.RECRUITER, description="User role for RBAC")
    company_id: str | None = Field(None, description="Associated company ID")
    full_name: str | None = Field(None, description="User's full name")
    avatar_url: str | None = Field(None, description="User's avatar URL")

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "recruiter@company.com",
                "role": "recruiter",
                "company_id": "company-123",
                "full_name": "Jane Doe",
                "avatar_url": "https://example.com/avatar.jpg",
            }
        }


class LoginRequest(BaseModel):
    """Login request payload."""

    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=6, description="User password")


class LoginResponse(BaseModel):
    """Login response with tokens."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="Refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")
    user: User = Field(..., description="Authenticated user data")


class RefreshTokenRequest(BaseModel):
    """Refresh token request payload."""

    refresh_token: str = Field(..., description="Refresh token from login")


class SignupRequest(BaseModel):
    """User signup request payload."""

    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=8, description="User password")
    full_name: str | None = Field(None, description="User's full name")
    company_id: str | None = Field(None, description="Company to join")


class PasswordResetRequest(BaseModel):
    """Password reset request payload."""

    email: EmailStr = Field(..., description="User email")


class PasswordUpdateRequest(BaseModel):
    """Password update request payload."""

    new_password: str = Field(..., min_length=8, description="New password")
