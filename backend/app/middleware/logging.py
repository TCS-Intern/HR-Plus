"""
Request logging middleware for TalentAI backend.

Automatically logs all HTTP requests with correlation IDs for distributed tracing.
Each request gets a unique correlation ID that is:
- Generated or extracted from the X-Correlation-ID header
- Added to all log entries during request processing
- Returned in the response X-Correlation-ID header

Usage:
    from fastapi import FastAPI
    from app.middleware.logging import RequestLoggingMiddleware

    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)
"""

import time
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.utils.logging import (
    generate_correlation_id,
    get_logger,
    set_correlation_id,
)

logger = get_logger(__name__)


# Paths to skip logging (health checks, static assets, etc.)
SKIP_LOGGING_PATHS = {
    "/health",
    "/favicon.ico",
    "/robots.txt",
}

# Headers to exclude from logging (sensitive data)
SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs all HTTP requests with correlation IDs.

    For each request:
    1. Generates or extracts a correlation ID
    2. Sets it in the context for all subsequent logs
    3. Logs request start with method, path, and client info
    4. Logs request completion with status code and duration
    5. Adds correlation ID to response headers

    The correlation ID enables tracing requests across logs and services.
    """

    def __init__(
        self,
        app: Callable,
        skip_paths: set[str] | None = None,
        log_request_body: bool = False,
        log_response_body: bool = False,
    ) -> None:
        """Initialize the middleware.

        Args:
            app: The FastAPI application.
            skip_paths: Paths to skip logging for.
            log_request_body: Whether to log request bodies (careful with PII).
            log_response_body: Whether to log response bodies.
        """
        super().__init__(app)
        self.skip_paths = skip_paths or SKIP_LOGGING_PATHS
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process a request through the logging middleware.

        Args:
            request: The incoming request.
            call_next: Function to call the next middleware/handler.

        Returns:
            Response from the handler.
        """
        # Skip logging for certain paths
        if request.url.path in self.skip_paths:
            return await call_next(request)

        # Extract or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID")
        if not correlation_id:
            correlation_id = generate_correlation_id()

        # Set correlation ID in context for all logs during this request
        set_correlation_id(correlation_id)

        # Extract client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "unknown")

        # Log request start
        start_time = time.time()
        logger.info(
            "Request started",
            extra={
                "http_method": request.method,
                "path": request.url.path,
                "query_string": str(request.query_params) if request.query_params else None,
                "client_ip": client_ip,
                "user_agent": user_agent[:100] if user_agent else None,  # Truncate long UAs
                "headers": self._safe_headers(request.headers),
            },
        )

        # Process the request
        try:
            response = await call_next(request)
        except Exception as exc:
            # Log unhandled exceptions
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(
                "Request failed with unhandled exception",
                extra={
                    "http_method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                exc_info=True,
            )
            raise

        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)

        # Determine log level based on status code
        status_code = response.status_code
        if status_code >= 500:
            log_func = logger.error
        elif status_code >= 400:
            log_func = logger.warning
        else:
            log_func = logger.info

        # Log request completion
        log_func(
            "Request completed",
            extra={
                "http_method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "response_size": response.headers.get("Content-Length"),
            },
        )

        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract the real client IP from the request.

        Checks proxy headers first, then falls back to direct connection IP.

        Args:
            request: The incoming request.

        Returns:
            Client IP address string.
        """
        # Check X-Forwarded-For (set by proxies/load balancers)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP (original client)
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP (nginx)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct connection
        if request.client:
            return request.client.host

        return "unknown"

    def _safe_headers(self, headers) -> dict[str, str]:
        """Extract headers while masking sensitive values.

        Args:
            headers: Request headers mapping.

        Returns:
            Dict of headers with sensitive values masked.
        """
        safe = {}
        for key, value in headers.items():
            key_lower = key.lower()
            if key_lower in SENSITIVE_HEADERS:
                safe[key] = "[REDACTED]"
            else:
                # Truncate very long header values
                safe[key] = value[:200] if len(value) > 200 else value
        return safe


def get_request_info(request: Request) -> dict:
    """Extract request information for logging.

    Utility function for endpoint handlers that want to include
    request context in their logs.

    Args:
        request: The FastAPI request object.

    Returns:
        Dict with request metadata.
    """
    return {
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.headers.get(
            "X-Forwarded-For",
            request.headers.get("X-Real-IP", request.client.host if request.client else "unknown"),
        ),
    }
