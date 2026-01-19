"""
Rate limiting middleware for TalentAI backend.

Implements a sliding window rate limiter using in-memory storage.
Configurable limits per endpoint pattern with special handling for
expensive AI operations.

Default Limits:
- General API endpoints: 100 requests/minute
- AI operations (screening, assessment, offer generation): 10 requests/minute
- Health checks: 1000 requests/minute (effectively unlimited)

Usage:
    from fastapi import FastAPI
    from app.middleware.rate_limit import RateLimitMiddleware

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

For production, consider replacing in-memory storage with Redis
for distributed rate limiting across multiple instances.
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limit rules.

    Attributes:
        requests: Maximum number of requests allowed.
        window_seconds: Time window in seconds for the limit.
        description: Human-readable description of the limit.
    """

    requests: int
    window_seconds: int = 60
    description: str = ""


@dataclass
class RateLimitState:
    """Tracks rate limit state for a single key.

    Uses a sliding window algorithm: stores timestamps of recent requests
    and counts only those within the current window.

    Attributes:
        timestamps: List of request timestamps within the window.
        lock: Thread lock for concurrent access safety.
    """

    timestamps: list[float] = field(default_factory=list)
    lock: Lock = field(default_factory=Lock)


class InMemoryRateLimiter:
    """In-memory rate limiter with sliding window algorithm.

    Thread-safe implementation suitable for single-instance deployments.
    For multi-instance deployments, replace with Redis-backed implementation.

    Note: Memory usage grows with number of unique client IPs. Consider
    implementing periodic cleanup for long-running applications.
    """

    def __init__(self) -> None:
        """Initialize the rate limiter with empty state."""
        # Nested dict: endpoint_pattern -> client_key -> RateLimitState
        self._state: dict[str, dict[str, RateLimitState]] = defaultdict(
            lambda: defaultdict(RateLimitState)
        )
        self._global_lock = Lock()

    def is_allowed(
        self,
        key: str,
        endpoint_pattern: str,
        config: RateLimitConfig,
    ) -> tuple[bool, int, int]:
        """Check if a request is allowed under the rate limit.

        Args:
            key: Client identifier (usually IP address).
            endpoint_pattern: Pattern identifying the endpoint type.
            config: Rate limit configuration to apply.

        Returns:
            Tuple of (is_allowed, remaining_requests, retry_after_seconds).
        """
        current_time = time.time()
        window_start = current_time - config.window_seconds

        with self._global_lock:
            state = self._state[endpoint_pattern][key]

        with state.lock:
            # Remove expired timestamps (outside current window)
            state.timestamps = [
                ts for ts in state.timestamps if ts > window_start
            ]

            # Check if under limit
            current_count = len(state.timestamps)
            remaining = max(0, config.requests - current_count)

            if current_count >= config.requests:
                # Calculate retry-after based on oldest request in window
                if state.timestamps:
                    oldest = min(state.timestamps)
                    retry_after = int(oldest + config.window_seconds - current_time) + 1
                else:
                    retry_after = config.window_seconds
                return False, 0, retry_after

            # Allow request and record timestamp
            state.timestamps.append(current_time)
            return True, remaining - 1, 0

    def get_usage(self, key: str, endpoint_pattern: str) -> int:
        """Get current request count for a key.

        Args:
            key: Client identifier.
            endpoint_pattern: Endpoint pattern to check.

        Returns:
            Number of requests in the current window.
        """
        with self._global_lock:
            state = self._state[endpoint_pattern].get(key)
            if not state:
                return 0

        current_time = time.time()
        with state.lock:
            # Count only non-expired timestamps
            count = sum(
                1 for ts in state.timestamps
                if ts > current_time - 60  # Default window
            )
            return count

    def reset(self, key: str | None = None, endpoint_pattern: str | None = None) -> None:
        """Reset rate limit state.

        Args:
            key: If provided, reset only this client's state.
            endpoint_pattern: If provided, reset only this endpoint's state.
        """
        with self._global_lock:
            if endpoint_pattern and key:
                if endpoint_pattern in self._state:
                    self._state[endpoint_pattern].pop(key, None)
            elif endpoint_pattern:
                self._state.pop(endpoint_pattern, None)
            elif key:
                for pattern_state in self._state.values():
                    pattern_state.pop(key, None)
            else:
                self._state.clear()


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()

# Rate limit configurations by endpoint pattern
RATE_LIMITS: dict[str, RateLimitConfig] = {
    # Health and status endpoints - high limit
    "health": RateLimitConfig(
        requests=1000,
        window_seconds=60,
        description="Health check endpoints",
    ),
    # AI-powered operations - strict limit due to cost and latency
    "ai_operations": RateLimitConfig(
        requests=10,
        window_seconds=60,
        description="AI operations (screening, assessment, offers)",
    ),
    # Bulk operations - moderate limit
    "bulk": RateLimitConfig(
        requests=20,
        window_seconds=60,
        description="Bulk operations",
    ),
    # Standard API endpoints - general limit
    "default": RateLimitConfig(
        requests=100,
        window_seconds=60,
        description="General API endpoints",
    ),
}

# Mapping of URL patterns to rate limit categories
ENDPOINT_PATTERNS: list[tuple[str, str]] = [
    # Health endpoints
    ("/health", "health"),
    ("/api/v1/health", "health"),
    # AI operations (expensive)
    ("/api/v1/jd/generate", "ai_operations"),
    ("/api/v1/screening/screen", "ai_operations"),
    ("/api/v1/screening/batch", "ai_operations"),
    ("/api/v1/assessment/analyze", "ai_operations"),
    ("/api/v1/assessment/generate-questions", "ai_operations"),
    ("/api/v1/offer/generate", "ai_operations"),
    ("/api/v1/phone-screen/analyze", "ai_operations"),
    ("/api/v1/sourcing/score", "ai_operations"),
    ("/api/v1/campaigns/personalize", "ai_operations"),
    # Bulk operations
    ("/api/v1/candidates/bulk", "bulk"),
    ("/api/v1/sourcing/bulk", "bulk"),
]


def get_endpoint_pattern(path: str) -> str:
    """Determine the rate limit category for a request path.

    Args:
        path: The request URL path.

    Returns:
        The rate limit category key.
    """
    for pattern, category in ENDPOINT_PATTERNS:
        if path.startswith(pattern):
            return category
    return "default"


def get_rate_limit_key(request: Request) -> str:
    """Extract the rate limit key from a request.

    Uses client IP address as the key. For authenticated requests,
    consider using user ID instead for more accurate per-user limiting.

    Args:
        request: The incoming request.

    Returns:
        String key for rate limiting.
    """
    # Try to get real IP from proxy headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP in the chain (original client)
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client IP
    if request.client:
        return request.client.host

    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting requests.

    Applies rate limits based on client IP and endpoint pattern.
    Returns 429 Too Many Requests when limits are exceeded.

    Response headers included:
    - X-RateLimit-Limit: Maximum requests allowed
    - X-RateLimit-Remaining: Requests remaining in current window
    - X-RateLimit-Reset: Seconds until window resets
    - Retry-After: Seconds to wait before retrying (when rate limited)
    """

    def __init__(
        self,
        app: Callable,
        limiter: InMemoryRateLimiter | None = None,
        key_func: Callable[[Request], str] | None = None,
    ) -> None:
        """Initialize the middleware.

        Args:
            app: The FastAPI application.
            limiter: Rate limiter instance. Uses global if not provided.
            key_func: Function to extract rate limit key from request.
        """
        super().__init__(app)
        self.limiter = limiter or rate_limiter
        self.key_func = key_func or get_rate_limit_key

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process a request through the rate limiter.

        Args:
            request: The incoming request.
            call_next: Function to call the next middleware/handler.

        Returns:
            Response from the handler or 429 if rate limited.
        """
        # Extract rate limit key and determine endpoint pattern
        key = self.key_func(request)
        pattern = get_endpoint_pattern(request.url.path)
        config = RATE_LIMITS.get(pattern, RATE_LIMITS["default"])

        # Check rate limit
        is_allowed, remaining, retry_after = self.limiter.is_allowed(
            key, pattern, config
        )

        if not is_allowed:
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "client_ip": key,
                    "path": request.url.path,
                    "pattern": pattern,
                    "retry_after": retry_after,
                },
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    "retry_after": retry_after,
                },
                headers={
                    "X-RateLimit-Limit": str(config.requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(config.window_seconds),
                    "Retry-After": str(retry_after),
                },
            )

        # Process the request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(config.requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(config.window_seconds)

        return response


# Decorator for applying custom rate limits to specific endpoints
def rate_limit(
    requests: int = 100,
    window_seconds: int = 60,
    key_func: Callable[[Request], str] | None = None,
) -> Callable:
    """Decorator for applying custom rate limits to endpoints.

    Use this for fine-grained control over specific endpoints.
    The middleware applies general limits; this allows overrides.

    Args:
        requests: Maximum requests allowed in window.
        window_seconds: Window duration in seconds.
        key_func: Custom function to extract rate limit key.

    Returns:
        Decorator function.

    Example:
        @router.post("/expensive-operation")
        @rate_limit(requests=5, window_seconds=60)
        async def expensive_operation():
            ...
    """
    from functools import wraps

    config = RateLimitConfig(requests=requests, window_seconds=window_seconds)

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            key = (key_func or get_rate_limit_key)(request)
            is_allowed, remaining, retry_after = rate_limiter.is_allowed(
                key, f"custom:{func.__name__}", config
            )

            if not is_allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Too Many Requests",
                        "message": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                        "retry_after": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator
