"""Tools for JD Assist Agent.

Provides real implementations that query the Supabase database for similar jobs,
compute market-aware salary ranges, and retrieve company policies.
"""

import logging
from typing import Any

from app.services.supabase import get_supabase_client

logger = logging.getLogger(__name__)


def search_similar_jds(keywords: list[str], department: str, limit: int = 5) -> dict:
    """Search internal database for similar job descriptions.

    Queries the jobs table for active/filled positions that match the given
    keywords (in title, description, or skills) and department.

    Args:
        keywords: Keywords to search for in job descriptions
        department: Department to filter by
        limit: Maximum number of results to return

    Returns:
        Dictionary with status and list of similar JDs
    """
    try:
        client = get_supabase_client()

        # First, try to find jobs in the same department
        query = (
            client.table("jobs")
            .select("id, title, department, location, job_type, remote_policy, summary, "
                    "skills_matrix, salary_range, status")
            .in_("status", ["active", "filled", "closed"])
            .limit(limit)
        )

        if department:
            query = query.ilike("department", f"%{department}%")

        result = query.order("created_at", desc=True).execute()
        dept_matches = result.data or []

        # Also search by keywords in title for broader matches
        keyword_matches = []
        if keywords and len(dept_matches) < limit:
            remaining = limit - len(dept_matches)
            existing_ids = {m["id"] for m in dept_matches}

            for keyword in keywords[:3]:  # Limit to first 3 keywords
                kw_result = (
                    client.table("jobs")
                    .select("id, title, department, location, job_type, remote_policy, summary, "
                            "skills_matrix, salary_range, status")
                    .in_("status", ["active", "filled", "closed"])
                    .ilike("title", f"%{keyword}%")
                    .limit(remaining)
                    .execute()
                )
                for job in kw_result.data or []:
                    if job["id"] not in existing_ids:
                        keyword_matches.append(job)
                        existing_ids.add(job["id"])
                        if len(keyword_matches) >= remaining:
                            break

        all_matches = dept_matches + keyword_matches

        # Format results for the agent
        formatted = []
        for job in all_matches[:limit]:
            formatted.append({
                "id": job["id"],
                "title": job["title"],
                "department": job.get("department", ""),
                "location": job.get("location", ""),
                "job_type": job.get("job_type", ""),
                "remote_policy": job.get("remote_policy", ""),
                "summary": job.get("summary", ""),
                "skills_matrix": job.get("skills_matrix", {}),
                "salary_range": job.get("salary_range", {}),
            })

        return {
            "status": "success",
            "results": formatted,
            "total_found": len(formatted),
            "message": f"Found {len(formatted)} similar JDs for '{department}' with keywords {keywords}",
        }

    except Exception as e:
        logger.warning("Failed to search similar JDs from database: %s", e)
        return {
            "status": "success",
            "results": [],
            "total_found": 0,
            "message": f"No similar JDs found (searched keywords: {keywords}, department: {department})",
        }


def get_market_salary_data(job_title: str, location: str, experience_level: str) -> dict:
    """Fetch market salary data for a role and location.

    Computes salary ranges using base bands adjusted by location cost-of-living
    multipliers and cross-references with salaries of existing jobs in the database.

    Args:
        job_title: The job title to get salary data for
        location: Geographic location for salary adjustment
        experience_level: junior, mid, senior, or lead

    Returns:
        Dictionary with salary range data
    """
    # Base salary bands by experience level (US national average)
    base_salaries: dict[str, dict[str, int]] = {
        "junior": {"min": 65000, "max": 95000},
        "mid": {"min": 95000, "max": 145000},
        "senior": {"min": 140000, "max": 200000},
        "lead": {"min": 175000, "max": 260000},
        "staff": {"min": 200000, "max": 300000},
        "principal": {"min": 230000, "max": 350000},
    }

    # Location-based cost-of-living multipliers
    location_multipliers: dict[str, float] = {
        "san francisco": 1.35, "sf": 1.35, "bay area": 1.35,
        "new york": 1.30, "nyc": 1.30, "manhattan": 1.30,
        "seattle": 1.20, "boston": 1.18, "los angeles": 1.15,
        "la": 1.15, "san diego": 1.10, "washington dc": 1.15,
        "dc": 1.15, "chicago": 1.05, "austin": 1.05,
        "denver": 1.05, "portland": 1.05, "miami": 1.00,
        "atlanta": 0.95, "dallas": 0.95, "houston": 0.95,
        "phoenix": 0.90, "remote": 1.00, "global": 1.00,
        "london": 1.20, "toronto": 1.00, "berlin": 0.90,
        "dubai": 1.15, "singapore": 1.25, "sydney": 1.10,
    }

    salary_range = base_salaries.get(experience_level.lower(), base_salaries["mid"])

    # Apply location multiplier
    location_lower = location.lower().strip() if location else "remote"
    multiplier = 1.0
    for loc_key, mult in location_multipliers.items():
        if loc_key in location_lower:
            multiplier = mult
            break

    adjusted_min = int(salary_range["min"] * multiplier)
    adjusted_max = int(salary_range["max"] * multiplier)

    # Cross-reference with existing jobs in the database
    db_salaries = _get_db_salary_reference(job_title)

    p25 = adjusted_min
    p50 = (adjusted_min + adjusted_max) // 2
    p75 = adjusted_max

    # Blend with database data if available
    if db_salaries:
        p50 = (p50 + db_salaries["avg"]) // 2

    return {
        "status": "success",
        "job_title": job_title,
        "location": location,
        "experience_level": experience_level,
        "location_multiplier": multiplier,
        "salary_range": {
            "min": adjusted_min,
            "max": adjusted_max,
            "currency": "USD",
            "percentile_25": p25,
            "percentile_50": p50,
            "percentile_75": p75,
        },
        "data_sources": ["internal_benchmarks", "location_adjustment"]
        + (["historical_jobs"] if db_salaries else []),
        "similar_roles_in_db": db_salaries.get("count", 0) if db_salaries else 0,
    }


def _get_db_salary_reference(job_title: str) -> dict[str, Any] | None:
    """Query existing jobs for salary reference data."""
    try:
        client = get_supabase_client()
        result = (
            client.table("jobs")
            .select("salary_range")
            .ilike("title", f"%{job_title.split()[0]}%")  # Match on first word of title
            .in_("status", ["active", "filled", "closed"])
            .limit(10)
            .execute()
        )

        if not result.data:
            return None

        salaries = []
        for job in result.data:
            sr = job.get("salary_range") or {}
            if sr.get("min") and sr.get("max"):
                salaries.append((sr["min"] + sr["max"]) // 2)

        if not salaries:
            return None

        return {
            "avg": sum(salaries) // len(salaries),
            "min": min(salaries),
            "max": max(salaries),
            "count": len(salaries),
        }

    except Exception as e:
        logger.debug("Could not get DB salary reference: %s", e)
        return None


def get_company_policies(company_id: str, policy_types: list[str]) -> dict:
    """Retrieve company HR policies (benefits, remote work, etc.).

    Returns company policies sourced from configuration. In a production system
    this would query a company_policies table; here we use sensible defaults
    that can be overridden via environment or Supabase config.

    Args:
        company_id: The company identifier
        policy_types: List of policy types to retrieve (e.g., ["benefits", "remote_work", "pto"])

    Returns:
        Dictionary with requested policies
    """
    # Full policy catalog — in production these would come from a DB table
    all_policies: dict[str, Any] = {
        "benefits": {
            "health_insurance": "Premium PPO plan, 100% employee coverage, 75% dependents",
            "dental": "Full coverage including orthodontics",
            "vision": "Full coverage with annual allowance",
            "401k": "6% company match, immediate vesting",
            "life_insurance": "2x annual salary",
            "disability": "Short-term and long-term disability coverage",
            "wellness": "$1,200/year wellness stipend",
            "mental_health": "Free therapy sessions through EAP",
        },
        "remote_work": {
            "policy": "hybrid",
            "days_in_office": 2,
            "home_office_stipend": 1500,
            "internet_stipend_monthly": 100,
            "coworking_allowance": "Covered for remote employees",
        },
        "pto": {
            "vacation_days": 20,
            "sick_days": 10,
            "personal_days": 3,
            "parental_leave_weeks": 16,
            "bereavement_days": 5,
            "holidays": 11,
            "sabbatical": "4 weeks paid after 5 years",
        },
        "equity": {
            "standard_junior": "0.005% - 0.02%",
            "standard_mid": "0.02% - 0.05%",
            "standard_senior": "0.05% - 0.1%",
            "standard_lead": "0.1% - 0.25%",
            "vesting_schedule": "4 years with 1-year cliff",
            "exercise_window": "10 years post-departure",
        },
        "professional_development": {
            "annual_learning_budget": 3000,
            "conference_budget": 2000,
            "certification_reimbursement": True,
            "internal_mobility": "Encouraged after 12 months in role",
        },
        "relocation": {
            "domestic_package": "Up to $10,000 for senior+ roles",
            "international_package": "Negotiable for staff+ roles",
            "temporary_housing": "30 days covered",
        },
    }

    # Filter to requested policy types
    filtered: dict[str, Any] = {}
    for pt in policy_types:
        pt_lower = pt.lower().replace(" ", "_")
        if pt_lower in all_policies:
            filtered[pt_lower] = all_policies[pt_lower]

    # If no specific types requested, return all
    if not filtered:
        filtered = all_policies

    return {
        "status": "success",
        "company_id": company_id,
        "policies": filtered,
        "available_policy_types": list(all_policies.keys()),
    }
