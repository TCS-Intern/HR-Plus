"""Proxycurl API integration for LinkedIn profile enrichment.

Proxycurl provides a way to fetch LinkedIn profile data without using
LinkedIn's official API, which has strict access requirements.
"""

import asyncio
from datetime import datetime
from typing import Any

import httpx

from app.config import settings


class ProxycurlService:
    """Service for interacting with Proxycurl API.

    Proxycurl provides:
    - LinkedIn profile lookup by URL
    - Profile enrichment (work experience, education, skills)
    - Company data lookup
    - Email lookup from LinkedIn URL
    """

    BASE_URL = "https://nubela.co/proxycurl/api"

    # Rate limiting: Proxycurl has generous limits but we should be mindful
    RATE_LIMIT_REQUESTS = 100
    RATE_LIMIT_WINDOW = 60  # seconds

    def __init__(self) -> None:
        # Proxycurl API key - add to config.py if needed
        self.api_key = getattr(settings, "proxycurl_api_key", "")
        self._request_timestamps: list[float] = []

    @property
    def _headers(self) -> dict[str, str]:
        """Get request headers with API key."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _rate_limit(self) -> None:
        """Implement rate limiting to avoid API throttling."""
        import time

        now = time.time()
        # Remove timestamps older than the rate limit window
        self._request_timestamps = [
            ts for ts in self._request_timestamps if now - ts < self.RATE_LIMIT_WINDOW
        ]

        if len(self._request_timestamps) >= self.RATE_LIMIT_REQUESTS:
            # Wait until the oldest request expires
            sleep_time = self.RATE_LIMIT_WINDOW - (now - self._request_timestamps[0])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

        self._request_timestamps.append(time.time())

    async def _make_request(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Make a GET request to Proxycurl API.

        Args:
            endpoint: API endpoint path
            params: Query parameters

        Returns:
            Response data as dictionary

        Raises:
            httpx.HTTPStatusError: If the request fails
        """
        await self._rate_limit()

        url = f"{self.BASE_URL}/{endpoint}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                url,
                headers=self._headers,
                params=params,
            )
            response.raise_for_status()
            return response.json()

    @property
    def is_configured(self) -> bool:
        """Check if API key is configured."""
        return bool(self.api_key)

    async def search_people(
        self,
        job_titles: list[str] | None = None,
        skills: list[str] | None = None,
        locations: list[str] | None = None,
        companies: list[str] | None = None,
        industries: list[str] | None = None,
        limit: int = 25,
    ) -> dict[str, Any]:
        """Search for people on LinkedIn using Proxycurl Person Search API.

        This is a powerful search API that costs ~$0.03 per result.

        Args:
            job_titles: Job titles to match (OR logic)
            skills: Skills to filter by (via headline/summary)
            locations: Country or region names
            companies: Company names
            industries: Industry names
            limit: Max results (up to 100)

        Returns:
            Dictionary with matched profiles
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Proxycurl API key not configured. Get one at https://nubela.co/proxycurl/",
                "people": [],
            }

        # Build search parameters
        params: dict[str, Any] = {"page_size": min(limit, 100)}

        if job_titles:
            params["current_role_title"] = "|".join(job_titles)

        if locations:
            params["country"] = locations[0] if len(locations) == 1 else "|".join(locations)

        if companies:
            params["current_company_name"] = "|".join(companies)

        if industries:
            params["industry"] = "|".join(industries)

        # Skills matched via headline keywords
        if skills:
            params["headline_and_summary"] = " ".join(skills[:3])

        try:
            response = await self._make_request("search/person/", params=params)

            people = []
            for result in response.get("results", []):
                profile = result.get("profile", result)
                people.append(self._transform_profile(profile))

            return {
                "status": "success",
                "people": people,
                "total": response.get("total_result_count", len(people)),
                "next_page": response.get("next_page"),
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"Search failed: {e.response.status_code}"
            if e.response.status_code == 401:
                error_msg = "Invalid Proxycurl API key"
            return {"status": "error", "message": error_msg, "people": []}
        except Exception as e:
            return {"status": "error", "message": str(e), "people": []}

    async def get_profile(
        self,
        linkedin_url: str,
        use_cache: str = "if-present",
        skills: str = "include",
        inferred_salary: str = "skip",
        personal_email: str = "include",
        personal_contact_number: str = "include",
    ) -> dict[str, Any]:
        """Get a person's LinkedIn profile data.

        Args:
            linkedin_url: LinkedIn profile URL
            use_cache: Cache strategy ("if-present", "if-recent", or "skip")
            skills: Whether to include skills ("include" or "skip")
            inferred_salary: Whether to include inferred salary
            personal_email: Whether to include personal email if available
            personal_contact_number: Whether to include phone number if available

        Returns:
            Dictionary with profile data
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Proxycurl API key not configured",
                "profile": None,
            }

        if not linkedin_url:
            return {
                "status": "error",
                "message": "LinkedIn URL is required",
                "profile": None,
            }

        # Normalize LinkedIn URL
        linkedin_url = self._normalize_linkedin_url(linkedin_url)

        try:
            response = await self._make_request(
                "v2/linkedin",
                params={
                    "url": linkedin_url,
                    "use_cache": use_cache,
                    "skills": skills,
                    "inferred_salary": inferred_salary,
                    "personal_email": personal_email,
                    "personal_contact_number": personal_contact_number,
                },
            )

            # Transform to standardized format
            profile = self._transform_profile(response)

            return {
                "status": "success",
                "profile": profile,
                "raw_response": response,
            }

        except httpx.HTTPStatusError as e:
            error_message = f"Proxycurl API error: {e.response.status_code}"
            if e.response.status_code == 404:
                error_message = "LinkedIn profile not found"
            elif e.response.status_code == 401:
                error_message = "Invalid Proxycurl API key"
            elif e.response.status_code == 429:
                error_message = "Proxycurl rate limit exceeded"

            return {
                "status": "error",
                "message": error_message,
                "profile": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to fetch profile: {str(e)}",
                "profile": None,
            }

    async def lookup_email(
        self,
        linkedin_url: str,
    ) -> dict[str, Any]:
        """Look up email address for a LinkedIn profile.

        Args:
            linkedin_url: LinkedIn profile URL

        Returns:
            Dictionary with email data
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Proxycurl API key not configured",
                "email": None,
            }

        linkedin_url = self._normalize_linkedin_url(linkedin_url)

        try:
            response = await self._make_request(
                "contact-api/personal-email",
                params={"linkedin_profile_url": linkedin_url},
            )

            email = response.get("email")
            if email:
                return {
                    "status": "success",
                    "email": email,
                    "email_type": response.get("email_type", "unknown"),
                }
            else:
                return {
                    "status": "not_found",
                    "message": "Email not found for this profile",
                    "email": None,
                }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": f"Email lookup failed: {e.response.status_code}",
                "email": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Email lookup failed: {str(e)}",
                "email": None,
            }

    async def get_company(
        self,
        linkedin_url: str,
    ) -> dict[str, Any]:
        """Get company data from LinkedIn company page.

        Args:
            linkedin_url: LinkedIn company page URL

        Returns:
            Dictionary with company data
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Proxycurl API key not configured",
                "company": None,
            }

        try:
            response = await self._make_request(
                "linkedin/company",
                params={"url": linkedin_url},
            )

            return {
                "status": "success",
                "company": {
                    "name": response.get("name"),
                    "description": response.get("description"),
                    "website": response.get("website"),
                    "industry": response.get("industry"),
                    "company_size": response.get("company_size"),
                    "headquarters": response.get("hq", {}).get("full_address"),
                    "founded_year": response.get("founded_year"),
                    "linkedin_url": response.get("linkedin_internal_id"),
                },
                "raw_response": response,
            }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": f"Company lookup failed: {e.response.status_code}",
                "company": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Company lookup failed: {str(e)}",
                "company": None,
            }

    def _normalize_linkedin_url(self, url: str) -> str:
        """Normalize a LinkedIn URL to standard format.

        Args:
            url: LinkedIn URL (may have various formats)

        Returns:
            Normalized LinkedIn URL
        """

        # Remove query parameters and trailing slashes
        url = url.split("?")[0].rstrip("/")

        # Ensure https://
        if not url.startswith("http"):
            url = f"https://{url}"
        elif url.startswith("http://"):
            url = url.replace("http://", "https://")

        # Ensure www. prefix for LinkedIn
        if "linkedin.com/in/" in url and "www.linkedin.com" not in url:
            url = url.replace("linkedin.com", "www.linkedin.com")

        return url

    def _transform_profile(self, data: dict[str, Any]) -> dict[str, Any]:
        """Transform Proxycurl profile data to standardized format.

        Args:
            data: Raw profile data from Proxycurl

        Returns:
            Standardized profile data
        """
        # Extract name
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        full_name = data.get("full_name", f"{first_name} {last_name}".strip())

        # Extract current position from experiences
        experiences = data.get("experiences", [])
        current_title = ""
        current_company = ""

        for exp in experiences:
            # Current job has no end date or ends_at is null
            if exp.get("ends_at") is None:
                current_title = exp.get("title", "")
                current_company = exp.get("company", "")
                break

        # If no current job found, use headline or first experience
        if not current_title:
            current_title = data.get("headline", "")
            if experiences:
                current_company = experiences[0].get("company", "")

        # Extract location
        city = data.get("city", "")
        state = data.get("state", "")
        country = data.get("country", "")
        location_parts = [p for p in [city, state, country] if p]
        location = ", ".join(location_parts)

        # Extract skills
        skills = []
        for skill in data.get("skills", []):
            if isinstance(skill, str):
                skills.append(skill)
            elif isinstance(skill, dict):
                skills.append(skill.get("name", ""))
        skills = [s for s in skills if s][:20]  # Limit to 20 skills

        # Calculate experience years
        experience_years = self._calculate_experience_years(experiences)

        # Extract email and phone
        email = None
        phone = None

        personal_emails = data.get("personal_emails", [])
        if personal_emails:
            email = personal_emails[0]

        personal_numbers = data.get("personal_numbers", [])
        if personal_numbers:
            phone = personal_numbers[0]

        return {
            "name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "title": current_title,
            "company": current_company,
            "location": location,
            "profile_url": data.get("public_identifier", ""),
            "platform": "linkedin",
            "skills": skills,
            "experience_years": experience_years,
            "headline": data.get("headline", ""),
            "summary": data.get("summary", ""),
            "raw_data": {
                "proxycurl_id": data.get("profile_pic_url"),  # Using as unique ID
                "connections": data.get("connections"),
                "recommendations_count": data.get("recommendations", []),
                "education": data.get("education", []),
                "certifications": data.get("certifications", []),
                "languages": data.get("languages", []),
                "profile_picture": data.get("profile_pic_url"),
                "background_cover": data.get("background_cover_image_url"),
            },
        }

    def _calculate_experience_years(self, experiences: list[dict[str, Any]]) -> int | None:
        """Calculate total years of experience from work history.

        Args:
            experiences: List of work experiences

        Returns:
            Estimated years of experience or None
        """
        if not experiences:
            return None

        try:
            earliest_start = None

            for exp in experiences:
                starts_at = exp.get("starts_at")
                if starts_at and isinstance(starts_at, dict):
                    year = starts_at.get("year")
                    if year:
                        if earliest_start is None or year < earliest_start:
                            earliest_start = year

            if earliest_start:
                current_year = datetime.now().year
                return current_year - earliest_start

        except (ValueError, TypeError, KeyError):
            pass

        return None


# Create singleton instance
proxycurl = ProxycurlService()
