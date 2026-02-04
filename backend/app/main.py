"""FastAPI application entry point for TalentAI backend.

This module initializes the FastAPI application with:
- Structured JSON logging with correlation IDs
- Rate limiting middleware for API protection
- CORS configuration for frontend integration
- Health check endpoint

The application uses a lifespan context manager for proper
startup/shutdown handling of resources.
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.utils.logging import get_logger, setup_logging

# Initialize structured logging
# Use JSON format in production, human-readable in development
is_production = os.getenv("ENVIRONMENT", "development") == "production"
setup_logging(
    level=os.getenv("LOG_LEVEL", "INFO"),
    json_format=is_production,
    include_uvicorn=True,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events.

    Handles initialization of resources on startup and cleanup on shutdown.
    Currently logs startup/shutdown events; extend for database connections,
    cache initialization, or other resources.
    """
    # Startup
    logger.info(
        "Application starting",
        extra={
            "app_name": settings.app_name,
            "environment": os.getenv("ENVIRONMENT", "development"),
            "log_level": os.getenv("LOG_LEVEL", "INFO"),
        },
    )
    yield
    # Shutdown
    logger.info(
        "Application shutting down",
        extra={"app_name": settings.app_name},
    )


app = FastAPI(
    title=settings.app_name,
    description="Autonomous Talent Acquisition Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

# ============================================
# MIDDLEWARE CONFIGURATION
# ============================================
# Middleware is applied in reverse order (last added = first executed)
# Order: CORS -> Rate Limit -> Request Logging -> Routes

# CORS middleware - allow localhost and production URLs
# Must be added before other middleware to handle preflight requests
allowed_origins = [
    "http://localhost:3000",
    "https://hr-plus-talentai.vercel.app",
    "https://frontend-bloqai.vercel.app",
    "https://talentai.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now (can restrict later)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting middleware
# Protects API from abuse with different limits per endpoint type:
# - General endpoints: 100 requests/minute
# - AI operations: 10 requests/minute
# - Health checks: 1000 requests/minute
app.add_middleware(RateLimitMiddleware)

# Request logging middleware with correlation IDs
# Logs all requests with timing and adds X-Correlation-ID header
# Added last so it executes first (wraps rate limiting)
app.add_middleware(RequestLoggingMiddleware)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint.

    Used by load balancers, container orchestrators, and monitoring systems
    to verify the application is running and responsive.

    Returns:
        JSON object with status and app name.
    """
    return {"status": "healthy", "app": settings.app_name}


@app.get("/health/detailed")
async def detailed_health_check() -> dict:
    """Detailed health check with component status.

    Provides more detailed health information for debugging and monitoring.
    In production, this could check database connectivity, cache status, etc.

    Returns:
        JSON object with detailed health information.
    """
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "0.1.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "components": {
            "api": "healthy",
            # Add more component checks as needed:
            # "database": check_database(),
            # "cache": check_cache(),
            # "external_services": check_external_services(),
        },
    }
