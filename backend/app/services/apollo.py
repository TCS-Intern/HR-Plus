"""Apollo.io API integration for candidate sourcing and email enrichment."""

import asyncio
from typing import Any

import httpx

from app.config import settings


class ApolloService:
    """Service for interacting with Apollo.io API.

    Apollo.io provides:
    - People search by job title, skills, location
    - Email enrichment for found profiles
    - Company data enrichment
    """

    BASE_URL = "https://api.apollo.io/v1"

    # Rate limiting: Apollo has limits of 50 requests/minute for most endpoints
    RATE_LIMIT_REQUESTS = 50
    RATE_LIMIT_WINDOW = 60  # seconds

    def __init__(self) -> None:
        self.api_key = settings.apollo_api_key
        self._request_timestamps: list[float] = []

    @property
    def _headers(self) -> dict[str, str]:
        """Get request headers with API key."""
        return {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": self.api_key,
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
        method: str,
        endpoint: str,
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Make an API request to Apollo.io.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters

        Returns:
            Response data as dictionary

        Raises:
            httpx.HTTPStatusError: If the request fails
        """
        await self._rate_limit()

        url = f"{self.BASE_URL}/{endpoint}"

        if data is None:
            data = {}

        async with httpx.AsyncClient(timeout=30.0) as client:
            if method.upper() == "GET":
                response = await client.get(
                    url, headers=self._headers, params=params
                )
            else:
                response = await client.post(
                    url,
                    headers=self._headers,
                    json=data,
                    params=params,
                )

            response.raise_for_status()
            return response.json()

    async def search_people(
        self,
        job_titles: list[str] | None = None,
        skills: list[str] | None = None,
        locations: list[str] | None = None,
        person_seniorities: list[str] | None = None,
        current_company_keywords: list[str] | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> dict[str, Any]:
        """Search for people in Apollo's database.

        Args:
            job_titles: List of job titles to search for
            skills: List of skills to filter by
            locations: List of locations (cities, states, countries)
            person_seniorities: Seniority levels (e.g., "senior", "manager", "director")
            current_company_keywords: Keywords for current company
            page: Page number for pagination
            per_page: Results per page (max 100)

        Returns:
            Dictionary containing:
            - people: List of matching profiles
            - pagination: Pagination info
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Apollo API key not configured",
                "people": [],
                "pagination": {"total": 0, "page": page, "per_page": per_page},
            }

        data: dict[str, Any] = {
            "page": page,
            "per_page": min(per_page, 100),
        }

        if job_titles:
            data["person_titles"] = job_titles
        if skills:
            # Apollo uses q_keywords for skill-based search
            data["q_keywords"] = " ".join(skills)
        if locations:
            data["person_locations"] = locations
        if person_seniorities:
            data["person_seniorities"] = person_seniorities
        if current_company_keywords:
            data["q_organization_keyword_tags"] = current_company_keywords

        try:
            response = await self._make_request("POST", "mixed_people/search", data=data)

            people = response.get("people", [])
            pagination = response.get("pagination", {})

            # Transform to standardized format
            results = []
            for person in people:
                results.append(self._transform_person(person))

            return {
                "status": "success",
                "people": results,
                "pagination": {
                    "total": pagination.get("total_entries", 0),
                    "page": pagination.get("page", page),
                    "per_page": pagination.get("per_page", per_page),
                    "total_pages": pagination.get("total_pages", 1),
                },
                "raw_response": response,
            }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": f"Apollo API error: {e.response.status_code} - {e.response.text}",
                "people": [],
                "pagination": {"total": 0, "page": page, "per_page": per_page},
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Apollo search failed: {str(e)}",
                "people": [],
                "pagination": {"total": 0, "page": page, "per_page": per_page},
            }

    async def enrich_person(
        self,
        email: str | None = None,
        linkedin_url: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        organization_name: str | None = None,
    ) -> dict[str, Any]:
        """Enrich a person's profile with additional data.

        At least one of email, linkedin_url, or (first_name + last_name + organization_name)
        must be provided.

        Args:
            email: Person's email address
            linkedin_url: LinkedIn profile URL
            first_name: Person's first name
            last_name: Person's last name
            organization_name: Current organization name

        Returns:
            Enriched profile data
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Apollo API key not configured",
                "person": None,
            }

        data: dict[str, Any] = {}

        if email:
            data["email"] = email
        if linkedin_url:
            data["linkedin_url"] = linkedin_url
        if first_name:
            data["first_name"] = first_name
        if last_name:
            data["last_name"] = last_name
        if organization_name:
            data["organization_name"] = organization_name

        if not data:
            return {
                "status": "error",
                "message": "At least one identifier (email, linkedin_url, or name+company) required",
                "person": None,
            }

        try:
            response = await self._make_request("POST", "people/match", data=data)

            person = response.get("person")
            if person:
                return {
                    "status": "success",
                    "person": self._transform_person(person),
                    "raw_response": response,
                }
            else:
                return {
                    "status": "not_found",
                    "message": "No matching profile found",
                    "person": None,
                }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": f"Apollo API error: {e.response.status_code} - {e.response.text}",
                "person": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Enrichment failed: {str(e)}",
                "person": None,
            }

    async def find_email(
        self,
        first_name: str,
        last_name: str,
        organization_name: str | None = None,
        domain: str | None = None,
    ) -> dict[str, Any]:
        """Find a person's email address.

        Args:
            first_name: Person's first name
            last_name: Person's last name
            organization_name: Company name (optional if domain provided)
            domain: Company domain (optional if organization_name provided)

        Returns:
            Email finding results
        """
        if not self.api_key:
            return {
                "status": "error",
                "message": "Apollo API key not configured",
                "email": None,
            }

        if not organization_name and not domain:
            return {
                "status": "error",
                "message": "Either organization_name or domain is required",
                "email": None,
            }

        data: dict[str, Any] = {
            "first_name": first_name,
            "last_name": last_name,
        }

        if organization_name:
            data["organization_name"] = organization_name
        if domain:
            data["domain"] = domain

        try:
            # Use people/match endpoint for email finding
            response = await self._make_request("POST", "people/match", data=data)

            person = response.get("person", {})
            email = person.get("email")

            if email:
                return {
                    "status": "success",
                    "email": email,
                    "email_status": person.get("email_status", "unknown"),
                    "confidence": "high" if person.get("email_status") == "verified" else "medium",
                    "person": self._transform_person(person),
                }
            else:
                return {
                    "status": "not_found",
                    "message": "Email not found",
                    "email": None,
                }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": f"Apollo API error: {e.response.status_code} - {e.response.text}",
                "email": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Email finding failed: {str(e)}",
                "email": None,
            }

    def _transform_person(self, person: dict[str, Any]) -> dict[str, Any]:
        """Transform Apollo person data to standardized format.

        Args:
            person: Raw person data from Apollo API

        Returns:
            Standardized person data matching the SourceSearchResultItem schema
        """
        # Extract name
        name = person.get("name", "")
        first_name = person.get("first_name", "")
        last_name = person.get("last_name", "")

        if not first_name and name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        # Extract current employment
        employment = person.get("employment_history", [])
        current_employment = employment[0] if employment else {}
        organization = person.get("organization", {}) or {}

        current_title = (
            person.get("title") or current_employment.get("title") or person.get("headline", "")
        )
        current_company = (
            person.get("organization_name")
            or organization.get("name")
            or current_employment.get("organization_name")
            or ""
        )

        # Extract location
        city = person.get("city", "")
        state = person.get("state", "")
        country = person.get("country", "")
        location_parts = [p for p in [city, state, country] if p]
        location = ", ".join(location_parts)

        # Extract skills - Apollo stores these in different places
        skills = []
        if person.get("technologies"):
            skills.extend(person.get("technologies", []))
        if person.get("keywords"):
            skills.extend(person.get("keywords", []))

        # Calculate experience years from employment history
        experience_years = None
        if employment:
            try:
                from datetime import datetime

                earliest_start = None
                for job in employment:
                    start_date = job.get("start_date")
                    if start_date:
                        if isinstance(start_date, str):
                            # Try to parse year from start date
                            year = int(start_date.split("-")[0])
                            if earliest_start is None or year < earliest_start:
                                earliest_start = year
                if earliest_start:
                    experience_years = datetime.now().year - earliest_start
            except (ValueError, IndexError):
                pass

        return {
            "name": name or f"{first_name} {last_name}".strip(),
            "first_name": first_name,
            "last_name": last_name,
            "email": person.get("email"),
            "title": current_title,
            "company": current_company,
            "location": location,
            "profile_url": person.get("linkedin_url", ""),
            "platform": "apollo",
            "skills": skills[:20],  # Limit to 20 skills
            "experience_years": experience_years,
            "headline": person.get("headline", ""),
            "summary": person.get("seniority", ""),
            "phone": person.get("phone_numbers", [{}])[0].get("number")
            if person.get("phone_numbers")
            else None,
            "raw_data": {
                "apollo_id": person.get("id"),
                "email_status": person.get("email_status"),
                "seniority": person.get("seniority"),
                "departments": person.get("departments", []),
                "organization_id": organization.get("id"),
                "photo_url": person.get("photo_url"),
            },
        }


# Create singleton instance
apollo = ApolloService()
