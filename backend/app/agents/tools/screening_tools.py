"""Tools for Talent Screener Agent."""

import asyncio
from typing import Any


def parse_resume(document_url: str, format: str = "pdf") -> dict:
    """Extract structured data from a resume document.

    Args:
        document_url: URL to the resume document in storage
        format: Document format (pdf, docx)

    Returns:
        Dictionary with parsed resume data
    """
    # TODO: Implement actual resume parsing with pypdf/python-docx
    return {
        "status": "success",
        "document_url": document_url,
        "format": format,
        "parsed_data": {
            "contact": {
                "name": "",
                "email": "",
                "phone": "",
                "linkedin": "",
            },
            "summary": "",
            "experience": [],
            "education": [],
            "skills": [],
            "certifications": [],
        },
    }


def enrich_linkedin_profile(linkedin_url: str) -> dict:
    """Fetch additional data from LinkedIn profile using Apollo.io or Proxycurl.

    This function enriches a LinkedIn profile with additional data including
    contact information, employment history, and skills.

    Args:
        linkedin_url: URL to the candidate's LinkedIn profile

    Returns:
        Dictionary with enriched LinkedIn profile data
    """
    # Run the async function synchronously for tool compatibility
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're in an async context, create a new task
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, _enrich_linkedin_profile_async(linkedin_url))
                return future.result()
        else:
            return loop.run_until_complete(_enrich_linkedin_profile_async(linkedin_url))
    except RuntimeError:
        # No event loop, create one
        return asyncio.run(_enrich_linkedin_profile_async(linkedin_url))


async def _enrich_linkedin_profile_async(linkedin_url: str) -> dict[str, Any]:
    """Async implementation of LinkedIn profile enrichment.

    Tries Apollo.io first, then falls back to Proxycurl if available.

    Args:
        linkedin_url: URL to the candidate's LinkedIn profile

    Returns:
        Dictionary with enriched profile data
    """
    from app.services.apollo import apollo

    # Try Apollo.io first (using LinkedIn URL for enrichment)
    result = await apollo.enrich_person(linkedin_url=linkedin_url)

    if result.get("status") == "success" and result.get("person"):
        person = result["person"]
        return {
            "status": "success",
            "linkedin_url": linkedin_url,
            "profile_data": {
                "name": person.get("name", ""),
                "first_name": person.get("first_name", ""),
                "last_name": person.get("last_name", ""),
                "headline": person.get("headline", ""),
                "current_position": person.get("title", ""),
                "current_company": person.get("company", ""),
                "location": person.get("location", ""),
                "email": person.get("email"),
                "phone": person.get("phone"),
                "skills": person.get("skills", []),
                "experience_years": person.get("experience_years"),
                "summary": person.get("summary", ""),
            },
            "raw_data": person.get("raw_data", {}),
            "source": "apollo",
        }

    # Try Proxycurl as fallback if Apollo fails
    try:
        from app.services.proxycurl import proxycurl

        proxycurl_result = await proxycurl.get_profile(linkedin_url)

        if proxycurl_result.get("status") == "success" and proxycurl_result.get("profile"):
            profile = proxycurl_result["profile"]
            return {
                "status": "success",
                "linkedin_url": linkedin_url,
                "profile_data": {
                    "name": profile.get("name", ""),
                    "first_name": profile.get("first_name", ""),
                    "last_name": profile.get("last_name", ""),
                    "headline": profile.get("headline", ""),
                    "current_position": profile.get("title", ""),
                    "current_company": profile.get("company", ""),
                    "location": profile.get("location", ""),
                    "email": profile.get("email"),
                    "phone": profile.get("phone"),
                    "skills": profile.get("skills", []),
                    "experience_years": profile.get("experience_years"),
                    "summary": profile.get("summary", ""),
                },
                "raw_data": profile.get("raw_data", {}),
                "source": "proxycurl",
            }
    except ImportError:
        # Proxycurl service not available
        pass

    # Return error if both services fail
    return {
        "status": "error",
        "linkedin_url": linkedin_url,
        "profile_data": {
            "headline": "",
            "current_position": "",
            "connections": 0,
            "recommendations": 0,
            "skills_endorsed": [],
        },
        "message": result.get("message", "Failed to enrich profile"),
    }


def check_previous_applications(email: str, company_id: str) -> dict:
    """Check if candidate has applied before.

    Args:
        email: Candidate's email address
        company_id: Company identifier to check against

    Returns:
        Dictionary with previous application history
    """
    # TODO: Implement database lookup
    return {
        "status": "success",
        "email": email,
        "company_id": company_id,
        "previous_applications": [],
        "has_applied_before": False,
    }
