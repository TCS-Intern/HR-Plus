"""Tools for Talent Screener Agent."""

import asyncio
from typing import Any
from urllib.parse import urlparse

import httpx

from app.services.resume_parser import resume_parser
from app.services.storage import storage


async def download_file_from_url(url: str) -> tuple[bytes, str]:
    """Download a file from a URL.

    Args:
        url: URL to download the file from.

    Returns:
        Tuple of (file content as bytes, detected filename).

    Raises:
        ValueError: If the URL is invalid or download fails.
    """
    # Check if this is a Supabase storage path (not a full URL)
    if not url.startswith("http://") and not url.startswith("https://"):
        # Assume it's a Supabase storage path
        try:
            content = await storage.download_file(storage.BUCKET_RESUMES, url)
            filename = url.split("/")[-1]
            return content, filename
        except Exception as e:
            raise ValueError(f"Failed to download from storage: {str(e)}")

    # Full URL - download via HTTP
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()

            # Try to get filename from Content-Disposition header
            content_disposition = response.headers.get("content-disposition", "")
            filename = ""
            if "filename=" in content_disposition:
                import re

                match = re.search(r'filename="?([^";\n]+)"?', content_disposition)
                if match:
                    filename = match.group(1)

            # Fall back to URL path
            if not filename:
                parsed_url = urlparse(url)
                filename = parsed_url.path.split("/")[-1] or "resume.pdf"

            return response.content, filename
    except httpx.HTTPError as e:
        raise ValueError(f"Failed to download file: {str(e)}")


def detect_format_from_url(url: str) -> str:
    """Detect file format from URL or path.

    Args:
        url: URL or path to the file.

    Returns:
        File format: 'pdf', 'docx', or 'unknown'.
    """
    url_lower = url.lower()
    if url_lower.endswith(".pdf"):
        return "pdf"
    elif url_lower.endswith(".docx"):
        return "docx"
    elif url_lower.endswith(".doc"):
        return "doc"
    return "unknown"


async def parse_resume(document_url: str, format: str = "auto") -> dict[str, Any]:
    """Extract structured data from a resume document.

    Downloads the document from the given URL (supports both Supabase storage
    paths and full HTTP URLs), detects the format, and extracts structured
    information including contact details, summary, experience, education,
    skills, and certifications.

    Args:
        document_url: URL or storage path to the resume document.
        format: Document format ('pdf', 'docx', or 'auto' for auto-detection).

    Returns:
        Dictionary with parsed resume data:
        - status: 'success' or 'error'
        - document_url: The original URL
        - format: Detected or specified format
        - parsed_data: {
            contact: {name, email, phone, linkedin},
            summary: str,
            experience: [{company, title, start_date, end_date, description}, ...],
            education: [{school, degree, field, start_date, end_date}, ...],
            skills: [str, ...],
            certifications: [str, ...]
          }
        - raw_text: Full extracted text (for AI screening)
        - error: Error message if status is 'error'
    """
    try:
        # Download the file
        file_content, filename = await download_file_from_url(document_url)

        # Detect format if auto
        if format == "auto":
            format = detect_format_from_url(filename)
            if format == "unknown":
                # Try to detect from URL itself
                format = detect_format_from_url(document_url)

        # Use filename with proper extension for parsing
        if format == "pdf" and not filename.lower().endswith(".pdf"):
            filename = "resume.pdf"
        elif format == "docx" and not filename.lower().endswith(".docx"):
            filename = "resume.docx"

        # Parse the resume
        parsed_result = resume_parser.parse(file_content, filename)

        return {
            "status": parsed_result.get("status", "success"),
            "document_url": document_url,
            "format": format,
            "parsed_data": {
                "contact": parsed_result.get(
                    "contact",
                    {
                        "name": "",
                        "email": "",
                        "phone": "",
                        "linkedin": "",
                    },
                ),
                "summary": parsed_result.get("summary", ""),
                "experience": parsed_result.get("experience", []),
                "education": parsed_result.get("education", []),
                "skills": parsed_result.get("skills", []),
                "certifications": parsed_result.get("certifications", []),
            },
            "raw_text": parsed_result.get("raw_text", ""),
            "error": parsed_result.get("error"),
        }

    except ValueError as e:
        return {
            "status": "error",
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
            "raw_text": "",
            "error": str(e),
        }
    except Exception as e:
        return {
            "status": "error",
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
            "raw_text": "",
            "error": f"Unexpected error: {str(e)}",
        }


def parse_resume_sync(file_content: bytes, filename: str) -> dict[str, Any]:
    """Synchronously parse a resume from file content.

    This is a convenience function for cases where the file content
    is already available (e.g., direct upload).

    Args:
        file_content: Resume file content as bytes.
        filename: Original filename.

    Returns:
        Dictionary with parsed resume data (same format as parse_resume).
    """
    try:
        parsed_result = resume_parser.parse(file_content, filename)

        return {
            "status": parsed_result.get("status", "success"),
            "format": resume_parser.detect_format(filename),
            "parsed_data": {
                "contact": parsed_result.get(
                    "contact",
                    {
                        "name": "",
                        "email": "",
                        "phone": "",
                        "linkedin": "",
                    },
                ),
                "summary": parsed_result.get("summary", ""),
                "experience": parsed_result.get("experience", []),
                "education": parsed_result.get("education", []),
                "skills": parsed_result.get("skills", []),
                "certifications": parsed_result.get("certifications", []),
            },
            "raw_text": parsed_result.get("raw_text", ""),
            "error": parsed_result.get("error"),
        }
    except Exception as e:
        return {
            "status": "error",
            "format": "unknown",
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
            "raw_text": "",
            "error": str(e),
        }


def enrich_linkedin_profile(linkedin_url: str) -> dict:
    """Fetch additional data from LinkedIn profile using Apollo.io or Proxycurl.

    This function enriches a LinkedIn profile with additional data including
    contact information, employment history, and skills.

    Args:
        linkedin_url: URL to the candidate's LinkedIn profile.

    Returns:
        Dictionary with enriched LinkedIn profile data.
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
        email: Candidate's email address.
        company_id: Company identifier to check against.

    Returns:
        Dictionary with previous application history.
    """
    # TODO: Implement database lookup
    return {
        "status": "success",
        "email": email,
        "company_id": company_id,
        "previous_applications": [],
        "has_applied_before": False,
    }
