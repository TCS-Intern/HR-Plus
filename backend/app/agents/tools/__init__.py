"""Agent tools module."""

from app.agents.tools.jd_tools import search_similar_jds, get_market_salary_data, get_company_policies
from app.agents.tools.screening_tools import parse_resume, enrich_linkedin_profile, check_previous_applications
from app.agents.tools.assessment_tools import analyze_video_segment, transcribe_audio, get_industry_benchmarks
from app.agents.tools.offer_tools import (
    calculate_compensation,
    generate_offer_letter,
    check_comp_approval,
    create_onboarding_tasks,
)

__all__ = [
    "search_similar_jds",
    "get_market_salary_data",
    "get_company_policies",
    "parse_resume",
    "enrich_linkedin_profile",
    "check_previous_applications",
    "analyze_video_segment",
    "transcribe_audio",
    "get_industry_benchmarks",
    "calculate_compensation",
    "generate_offer_letter",
    "check_comp_approval",
    "create_onboarding_tasks",
]
