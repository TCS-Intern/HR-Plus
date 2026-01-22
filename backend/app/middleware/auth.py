"""Authentication middleware for FastAPI using Supabase JWT."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings
from app.schemas.auth import TokenPayload, User, UserRole

# Security scheme for Bearer token authentication
security = HTTPBearer(auto_error=False)


def get_supabase_jwt_secret() -> str:
    """
    Get the JWT secret for Supabase token verification.

    Supabase uses the service key or a separate JWT secret.
    For local development, you can extract it from your Supabase project settings.
    """
    # Supabase JWT secret is typically derived from the service key
    # or configured separately in project settings
    jwt_secret = getattr(settings, 'supabase_jwt_secret', None)
    if jwt_secret:
        return jwt_secret

    # Fallback: use service key (not recommended for production)
    # In production, set SUPABASE_JWT_SECRET environment variable
    return settings.supabase_service_key


async def decode_token(token: str) -> TokenPayload:
    """
    Decode and validate a Supabase JWT token.

    Args:
        token: The JWT token string

    Returns:
        TokenPayload containing user information

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Supabase JWTs use HS256 algorithm
        payload = jwt.decode(
            token,
            get_supabase_jwt_secret(),
            algorithms=["HS256"],
            audience="authenticated",
        )

        # Extract user information from token
        return TokenPayload(
            sub=payload.get("sub"),
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
            exp=payload.get("exp"),
            aud=payload.get("aud"),
            app_metadata=payload.get("app_metadata", {}),
            user_metadata=payload.get("user_metadata", {}),
        )

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> User:
    """
    FastAPI dependency to get the current authenticated user.

    Usage:
        @router.get("/protected")
        async def protected_route(user: User = Depends(get_current_user)):
            return {"user_id": user.id}

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        User object with authenticated user information

    Raises:
        HTTPException: If not authenticated or token is invalid
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_payload = await decode_token(credentials.credentials)

    if token_payload.sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Map app_metadata role to UserRole enum
    app_role = token_payload.app_metadata.get("role", "recruiter")
    try:
        user_role = UserRole(app_role)
    except ValueError:
        user_role = UserRole.RECRUITER  # Default role

    return User(
        id=token_payload.sub,
        email=token_payload.email or "",
        role=user_role,
        company_id=token_payload.app_metadata.get("company_id"),
        full_name=token_payload.user_metadata.get("full_name"),
        avatar_url=token_payload.user_metadata.get("avatar_url"),
    )


async def get_current_active_user(
    user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    FastAPI dependency to get the current active user.

    Can be extended to check if user is active/not disabled.

    Args:
        user: Current authenticated user

    Returns:
        Active user object
    """
    # Here you could add additional checks like:
    # - Is user account active/not disabled?
    # - Is user's subscription valid?
    # - etc.
    return user


# Type alias for cleaner dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*allowed_roles: UserRole) -> Callable:
    """
    Decorator factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        @require_role(UserRole.ADMIN)
        async def admin_route(user: CurrentUser):
            return {"admin": True}

    Args:
        *allowed_roles: One or more UserRole values that are allowed

    Returns:
        Dependency function that validates user role
    """
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(r.value for r in allowed_roles)}",
            )
        return user

    return Depends(role_checker)


def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    FastAPI dependency that requires admin role.

    Usage:
        @router.delete("/users/{user_id}")
        async def delete_user(user_id: str, admin: User = Depends(require_admin)):
            ...
    """
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def require_recruiter(user: User = Depends(get_current_user)) -> User:
    """
    FastAPI dependency that requires recruiter or higher role.

    Allowed roles: admin, recruiter
    """
    allowed = {UserRole.ADMIN, UserRole.RECRUITER}
    if user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter access required",
        )
    return user


def require_hiring_manager(user: User = Depends(get_current_user)) -> User:
    """
    FastAPI dependency that requires hiring manager or higher role.

    Allowed roles: admin, recruiter, hiring_manager
    """
    allowed = {UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER}
    if user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hiring manager access required",
        )
    return user


# Optional: Dependency for routes that can work with or without auth
async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> User | None:
    """
    Get current user if authenticated, otherwise return None.

    Useful for routes that have different behavior for authenticated vs anonymous users.
    """
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
