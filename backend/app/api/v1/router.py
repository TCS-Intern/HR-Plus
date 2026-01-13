"""API v1 main router."""

from fastapi import APIRouter

from app.api.v1 import jd, screening, assessment, offer, dashboard

api_router = APIRouter()

api_router.include_router(jd.router, prefix="/jd", tags=["JD Assist"])
api_router.include_router(screening.router, prefix="/screen", tags=["Screening"])
api_router.include_router(assessment.router, prefix="/assess", tags=["Assessment"])
api_router.include_router(offer.router, prefix="/offer", tags=["Offer"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
