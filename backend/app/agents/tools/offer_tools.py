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

    Renders a professional offer letter populated with the candidate's details,
    compensation breakdown, benefits summary, and acceptance terms.

    Args:
        template_id: Template identifier to use ("standard", "executive", "contract")
        offer_details: Details to populate in the template
        format: Output format (html, pdf)

    Returns:
        Dictionary with generated offer letter
    """
    candidate_name = offer_details.get("candidate_name", "Candidate")
    job_title = offer_details.get("job_title", "Position")
    department = offer_details.get("department", "")
    base_salary = offer_details.get("base_salary", 0)
    signing_bonus = offer_details.get("signing_bonus", 0)
    equity = offer_details.get("equity", "")
    start_date = offer_details.get("start_date", date.today() + timedelta(days=14))
    expiry_date = offer_details.get("expiry_date", date.today() + timedelta(days=7))
    location = offer_details.get("location", "")
    remote_policy = offer_details.get("remote_policy", "hybrid")
    manager_name = offer_details.get("manager_name", "Your Manager")
    company_name = offer_details.get("company_name", "Telentic")

    # Build compensation section
    comp_rows = f'<tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;">Base Salary</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${base_salary:,.0f}/year</td></tr>'
    if signing_bonus:
        comp_rows += f'<tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;">Signing Bonus</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${signing_bonus:,.0f}</td></tr>'
    if equity:
        comp_rows += f'<tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;">Equity Grant</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">{equity}</td></tr>'

    dept_line = f" in the <strong>{department}</strong> department" if department else ""
    location_line = f"<p><strong>Location:</strong> {location} ({remote_policy})</p>" if location else ""

    letter_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Offer Letter</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:40px 24px;color:#1f2937;line-height:1.6;">

<div style="text-align:center;margin-bottom:32px;">
  <h1 style="font-size:28px;margin:0;color:#111827;">{company_name}</h1>
  <p style="color:#6b7280;margin:4px 0 0;">Offer of Employment</p>
</div>

<p>Dear {candidate_name},</p>

<p>We are delighted to extend this offer of employment for the position of
<strong>{job_title}</strong>{dept_line} at {company_name}. After a thorough evaluation
of your qualifications and interviews with our team, we are confident you will
make an outstanding contribution.</p>

{location_line}

<h2 style="font-size:18px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Compensation Package</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
{comp_rows}
</table>

<h2 style="font-size:18px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Benefits</h2>
<ul>
  <li>Comprehensive health, dental, and vision insurance</li>
  <li>401(k) with 6% company match</li>
  <li>20 days paid vacation + 11 company holidays</li>
  <li>16 weeks paid parental leave</li>
  <li>$3,000 annual professional development budget</li>
  <li>Home office stipend for remote/hybrid employees</li>
</ul>

<h2 style="font-size:18px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Terms</h2>
<p><strong>Start Date:</strong> {start_date}</p>
<p><strong>Reporting To:</strong> {manager_name}</p>
<p>This offer is contingent upon successful completion of a background check
and verification of your right to work. Employment is at-will and may be
terminated by either party at any time.</p>

<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
  <p style="margin:0 0 8px;font-weight:600;">To accept this offer:</p>
  <p style="margin:0;">Please sign and return this letter by <strong>{expiry_date}</strong>.</p>
</div>

<p>We are excited about the possibility of you joining our team and look forward
to your response.</p>

<p style="margin-top:32px;">
Warm regards,<br>
<strong>The {company_name} Hiring Team</strong>
</p>

<div style="margin-top:48px;padding-top:24px;border-top:1px solid #e5e7eb;">
  <p><strong>Acceptance Signature:</strong></p>
  <div style="border-bottom:1px solid #1f2937;width:300px;height:40px;margin:8px 0;"></div>
  <p><strong>Date:</strong> _______________</p>
</div>

</body>
</html>"""

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
