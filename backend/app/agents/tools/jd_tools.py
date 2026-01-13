"""Tools for JD Assist Agent."""


def search_similar_jds(keywords: list[str], department: str, limit: int = 5) -> dict:
    """Search internal database for similar job descriptions.

    Args:
        keywords: Keywords to search for in job descriptions
        department: Department to filter by
        limit: Maximum number of results to return

    Returns:
        Dictionary with status and list of similar JDs
    """
    # TODO: Implement actual database search
    return {
        "status": "success",
        "results": [],
        "message": f"Searched for JDs with keywords {keywords} in {department}",
    }


def get_market_salary_data(job_title: str, location: str, experience_level: str) -> dict:
    """Fetch market salary data for a role and location.

    Args:
        job_title: The job title to get salary data for
        location: Geographic location for salary adjustment
        experience_level: junior, mid, senior, or lead

    Returns:
        Dictionary with salary range data
    """
    # TODO: Integrate with salary data API (e.g., Levels.fyi, Glassdoor)
    # Mock data for now
    base_salaries = {
        "junior": {"min": 70000, "max": 100000},
        "mid": {"min": 100000, "max": 150000},
        "senior": {"min": 150000, "max": 200000},
        "lead": {"min": 180000, "max": 250000},
    }

    salary_range = base_salaries.get(experience_level.lower(), base_salaries["mid"])

    return {
        "status": "success",
        "job_title": job_title,
        "location": location,
        "experience_level": experience_level,
        "salary_range": {
            "min": salary_range["min"],
            "max": salary_range["max"],
            "currency": "USD",
            "percentile_25": salary_range["min"],
            "percentile_50": (salary_range["min"] + salary_range["max"]) // 2,
            "percentile_75": salary_range["max"],
        },
    }


def get_company_policies(company_id: str, policy_types: list[str]) -> dict:
    """Retrieve company HR policies (benefits, remote work, etc.).

    Args:
        company_id: The company identifier
        policy_types: List of policy types to retrieve (e.g., ["benefits", "remote_work", "pto"])

    Returns:
        Dictionary with requested policies
    """
    # TODO: Implement actual policy retrieval from database
    return {
        "status": "success",
        "company_id": company_id,
        "policies": {
            "benefits": {
                "health_insurance": "Premium PPO plan, 100% employee coverage",
                "dental": "Full coverage",
                "vision": "Full coverage",
                "401k": "6% match",
                "pto": "Unlimited PTO",
            },
            "remote_work": {
                "policy": "hybrid",
                "days_in_office": 2,
                "stipend": 200,
            },
            "equity": {
                "standard_grant": "0.01% - 0.1%",
                "vesting": "4 years with 1 year cliff",
            },
        },
    }
