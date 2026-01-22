"""Middleware modules for the TalentAI backend."""

from app.middleware.auth import (
    CurrentUser,
    get_current_active_user,
    get_current_user,
    require_admin,
    require_hiring_manager,
    require_recruiter,
    require_role,
)
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import (
    RateLimitMiddleware,
    get_rate_limit_key,
    rate_limiter,
)

__all__ = [
    "RateLimitMiddleware",
    "rate_limiter",
    "get_rate_limit_key",
    "RequestLoggingMiddleware",
    "get_current_user",
    "get_current_active_user",
    "require_role",
    "require_admin",
    "require_recruiter",
    "require_hiring_manager",
    "CurrentUser",
]
