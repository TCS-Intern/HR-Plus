"""Tools for Offer Generator Agent."""

from datetime import date, timedelta


def calculate_compensation(
    job_level: str,
    location: str,
    experience_years: int,
    assessment_score: float,
    market_data: dict,
) -> dict:
    """Calculate recommended compensation based on inputs.

    Args:
        job_level: Job level (junior, mid, senior, lead)
        location: Geographic location
        experience_years: Years of relevant experience
        assessment_score: Assessment score (0-100)
        market_data: Market salary data

    Returns:
        Dictionary with recommended compensation
    """
    # Base salary calculation
    base_ranges = {
        "junior": {"min": 70000, "max": 100000},
        "mid": {"min": 100000, "max": 150000},
        "senior": {"min": 150000, "max": 200000},
        "lead": {"min": 180000, "max": 250000},
    }

    range_data = base_ranges.get(job_level.lower(), base_ranges["mid"])

    # Calculate position in range based on experience and assessment
    experience_factor = min(experience_years / 10, 1.0)  # Cap at 10 years
    assessment_factor = assessment_score / 100

    combined_factor = (experience_factor * 0.4) + (assessment_factor * 0.6)
    recommended_salary = (
        range_data["min"] + (range_data["max"] - range_data["min"]) * combined_factor
    )

    return {
        "status": "success",
        "recommended_base_salary": round(recommended_salary, -3),  # Round to nearest thousand
        "salary_range": range_data,
        "factors": {
            "experience_factor": experience_factor,
            "assessment_factor": assessment_factor,
            "combined_factor": combined_factor,
        },
        "signing_bonus_recommendation": round(recommended_salary * 0.1, -3)
        if assessment_score >= 85
        else 0,
        "equity_recommendation": "0.05%" if job_level in ["senior", "lead"] else "0.01%",
    }


def generate_offer_letter(template_id: str, offer_details: dict, format: str = "html") -> dict:
    """Generate formatted offer letter document.

    Args:
        template_id: Template identifier to use
        offer_details: Details to populate in the template
        format: Output format (html, pdf)

    Returns:
        Dictionary with generated offer letter
    """
    # TODO: Implement actual template rendering
    candidate_name = offer_details.get("candidate_name", "Candidate")
    job_title = offer_details.get("job_title", "Position")
    base_salary = offer_details.get("base_salary", 0)
    start_date = offer_details.get("start_date", date.today() + timedelta(days=14))

    letter_content = f"""
    <html>
    <body>
    <h1>Offer of Employment</h1>

    <p>Dear {candidate_name},</p>

    <p>We are thrilled to offer you the position of <strong>{job_title}</strong> at our company.
    After reviewing your qualifications and speaking with you during the interview process,
    we are confident that you will be a valuable addition to our team.</p>

    <h2>Compensation</h2>
    <p>Base Salary: ${base_salary:,.2f} per year</p>

    <h2>Start Date</h2>
    <p>Your anticipated start date is {start_date}.</p>

    <p>This offer is contingent upon successful completion of a background check.</p>

    <p>Please sign and return this letter by [expiry date] to indicate your acceptance.</p>

    <p>We look forward to welcoming you to the team!</p>

    <p>Best regards,<br>
    The Hiring Team</p>
    </body>
    </html>
    """

    return {
        "status": "success",
        "template_id": template_id,
        "format": format,
        "content": letter_content,
    }


def check_comp_approval(salary: float, equity: float, job_level: str) -> dict:
    """Check if compensation requires additional approval.

    Args:
        salary: Proposed base salary
        equity: Proposed equity percentage
        job_level: Job level

    Returns:
        Dictionary with approval status
    """
    # Define approval thresholds
    thresholds = {
        "junior": {"salary": 110000, "equity": 0.02},
        "mid": {"salary": 160000, "equity": 0.05},
        "senior": {"salary": 220000, "equity": 0.1},
        "lead": {"salary": 280000, "equity": 0.15},
    }

    level_threshold = thresholds.get(job_level.lower(), thresholds["mid"])

    needs_approval = salary > level_threshold["salary"] or equity > level_threshold["equity"]

    return {
        "status": "success",
        "needs_approval": needs_approval,
        "thresholds": level_threshold,
        "proposed": {"salary": salary, "equity": equity},
        "approval_reason": (
            "Exceeds standard compensation bands"
            if needs_approval
            else "Within standard approval limits"
        ),
    }


def create_onboarding_tasks(candidate_id: str, start_date: str, department: str) -> dict:
    """Create tasks in HR system for new hire onboarding.

    Args:
        candidate_id: Candidate identifier
        start_date: Expected start date
        department: Department the candidate will join

    Returns:
        Dictionary with created onboarding tasks
    """
    # TODO: Integrate with HR system
    standard_tasks = [
        {"task": "Complete I-9 verification", "owner": "hr", "due_before_start": True},
        {"task": "Set up payroll", "owner": "hr", "due_before_start": True},
        {"task": "Create email account", "owner": "it", "due_before_start": True},
        {"task": "Provision laptop", "owner": "it", "due_before_start": True},
        {"task": "Set up desk/workspace", "owner": "manager", "due_before_start": True},
        {"task": "Complete benefits enrollment", "owner": "candidate", "due_before_start": False},
        {"task": "Schedule orientation", "owner": "hr", "due_before_start": False},
        {"task": "First week goals meeting", "owner": "manager", "due_before_start": False},
    ]

    return {
        "status": "success",
        "candidate_id": candidate_id,
        "start_date": start_date,
        "department": department,
        "tasks": standard_tasks,
    }
