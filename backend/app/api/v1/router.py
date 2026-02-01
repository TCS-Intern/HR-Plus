"""API v1 main router."""

from fastapi import APIRouter

from app.api.v1 import (
    assessment,
    calcom,
    campaigns,
    credits,
    dashboard,
    email,
    jd,
    marathon,
    offer,
    phone_interview,
    phone_screen,
    screening,
    sourcing,
    sourcing_chat,
)

api_router = APIRouter()

api_router.include_router(jd.router, prefix="/jd", tags=["JD Assist"])
api_router.include_router(screening.router, prefix="/screen", tags=["Screening"])
api_router.include_router(assessment.router, prefix="/assess", tags=["Assessment"])
api_router.include_router(phone_screen.router, prefix="/phone-screen", tags=["Phone Screen"])
api_router.include_router(phone_interview.router, prefix="/phone-interview", tags=["Phone Interview"])
api_router.include_router(sourcing.router, prefix="/sourcing", tags=["Sourcing"])
api_router.include_router(sourcing_chat.router, tags=["Sourcing Chat"])
api_router.include_router(credits.router, tags=["Credits"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
api_router.include_router(calcom.router, prefix="/calcom", tags=["Cal.com Scheduling"])
api_router.include_router(offer.router, prefix="/offer", tags=["Offer"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(email.router, prefix="/email", tags=["Email"])
api_router.include_router(marathon.router, prefix="/marathon", tags=["Marathon Agent"])
