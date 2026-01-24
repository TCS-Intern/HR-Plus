"""Apify API integration for LinkedIn candidate sourcing.

Uses HarvestAPI LinkedIn Profile Search actor for reliable, cookie-free scraping.
"""

import asyncio
from typing import Any

import httpx

from app.config import settings


class ApifyService:
    """Service for interacting with Apify API to run LinkedIn scrapers.

    Uses HarvestAPI's LinkedIn Profile Search actor which:
    - Requires no cookies or LinkedIn login
    - Supports job title, keyword, and location filtering
    - Can find emails (in full_email mode)
    - Costs ~$0.10/page + $0.004-0.01/profile depending on mode
    """

    BASE_URL = "https://api.apify.com/v2"

    # HarvestAPI LinkedIn Profile Search (No Cookies Required)
    LINKEDIN_SEARCH_ACTOR = "harvestapi~linkedin-profile-search"

    # LinkedIn Profile Scraper for URL-based enrichment
    LINKEDIN_PROFILE_ACTOR = "harvestapi~linkedin-profile-scraper"

    # Rate limiting
    RATE_LIMIT_REQUESTS = 50
    RATE_LIMIT_WINDOW = 60  # seconds

    def __init__(self) -> None:
        self.api_token = settings.apify_api_token
        self._request_timestamps: list[float] = []

    @property
    def _headers(self) -> dict[str, str]:
        """Get request headers with API token."""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}",
        }

    async def _rate_limit(self) -> None:
        """Implement rate limiting to avoid API throttling."""
        import time

        now = time.time()
        self._request_timestamps = [
            ts for ts in self._request_timestamps if now - ts < self.RATE_LIMIT_WINDOW
        ]

        if len(self._request_timestamps) >= self.RATE_LIMIT_REQUESTS:
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
        timeout: float = 300.0,
    ) -> dict[str, Any]:
        """Make an API request to Apify.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            timeout: Request timeout in seconds

        Returns:
            Response data as dictionary

        Raises:
            httpx.HTTPStatusError: If the request fails
        """
        await self._rate_limit()

        url = f"{self.BASE_URL}/{endpoint}"

        async with httpx.AsyncClient(timeout=timeout) as client:
            if method.upper() == "GET":
                response = await client.get(
                    url,
                    headers=self._headers,
                    params=params,
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

    async def search_linkedin_people(
        self,
        job_titles: list[str] | None = None,
        skills: list[str] | None = None,
        locations: list[str] | None = None,
        companies: list[str] | None = None,
        keywords: str | None = None,
        limit: int = 25,
        include_emails: bool = False,
    ) -> dict[str, Any]:
        """Search for people on LinkedIn using HarvestAPI actor.

        This is a direct LinkedIn search that doesn't require cookies.

        Args:
            job_titles: List of job titles to search for
            skills: List of skills to filter by (used as keywords)
            locations: List of locations (cities, countries)
            companies: List of company names to filter by
            keywords: Additional search keywords
            limit: Maximum results to return
            include_emails: Whether to search for emails (costs more)

        Returns:
            Dictionary containing:
            - people: List of matching profiles
            - status: success/error
        """
        if not self.api_token:
            return {
                "status": "error",
                "message": "Apify API token not configured",
                "people": [],
            }

        # Build actor input
        actor_input: dict[str, Any] = {
            "startPage": 1,
            "takePages": max(1, (limit + 24) // 25),  # 25 results per page
        }

        # Set scraping mode
        if include_emails:
            actor_input["mode"] = "full_email"
        else:
            actor_input["mode"] = "full"

        # Add job titles filter
        if job_titles:
            actor_input["currentJobTitles"] = job_titles

        # Add location filter
        if locations:
            # HarvestAPI accepts location as a string
            actor_input["location"] = locations[0] if len(locations) == 1 else ", ".join(locations)

        # Add company filter
        if companies:
            actor_input["keywordsCompany"] = " OR ".join(companies)

        # Build keywords from skills and additional keywords
        keyword_parts = []
        if skills:
            keyword_parts.extend(skills)
        if keywords:
            keyword_parts.append(keywords)
        if keyword_parts:
            actor_input["keywords"] = " ".join(keyword_parts)

        try:
            # Run the actor and wait for results
            run_result = await self._run_actor(
                actor_id=self.LINKEDIN_SEARCH_ACTOR,
                run_input=actor_input,
                timeout_secs=300,
            )

            if run_result.get("status") != "success":
                return {
                    "status": "error",
                    "message": run_result.get("message", "Actor run failed"),
                    "people": [],
                }

            # Get results from dataset
            dataset_id = run_result.get("dataset_id")
            if not dataset_id:
                return {
                    "status": "success",
                    "people": [],
                    "total": 0,
                    "message": "No results found",
                }

            profiles = await self._get_dataset_items(dataset_id, limit=limit)

            # Transform results to standardized format
            people = []
            for profile in profiles:
                transformed = self._transform_harvestapi_profile(profile)
                if transformed:
                    people.append(transformed)

            return {
                "status": "success",
                "people": people[:limit],
                "total": len(people),
            }

        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": f"Apify API error: {e.response.status_code} - {e.response.text}",
                "people": [],
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"LinkedIn search failed: {str(e)}",
                "people": [],
            }

    async def _run_actor(
        self,
        actor_id: str,
        run_input: dict[str, Any],
        wait_for_finish: bool = True,
        timeout_secs: int = 300,
    ) -> dict[str, Any]:
        """Run an Apify actor and optionally wait for completion.

        Args:
            actor_id: Actor ID (e.g., "harvestapi~linkedin-profile-search")
            run_input: Input parameters for the actor
            wait_for_finish: Whether to wait for the actor to complete
            timeout_secs: Timeout for waiting

        Returns:
            Run result with status and dataset_id
        """
        endpoint = f"acts/{actor_id}/runs"

        try:
            response = await self._make_request(
                "POST",
                endpoint,
                data=run_input,
                timeout=30.0,
            )

            run_data = response.get("data", {})
            run_id = run_data.get("id")

            if not run_id:
                return {
                    "status": "error",
                    "message": "Failed to start actor run",
                }

            if not wait_for_finish:
                return {
                    "status": "running",
                    "run_id": run_id,
                }

            # Poll for completion
            return await self._wait_for_run(
                actor_id=actor_id,
                run_id=run_id,
                timeout_secs=timeout_secs,
            )

        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to run actor: {str(e)}",
            }

    async def _wait_for_run(
        self,
        actor_id: str,
        run_id: str,
        timeout_secs: int = 300,
        poll_interval: float = 2.0,
    ) -> dict[str, Any]:
        """Wait for an actor run to complete.

        Args:
            actor_id: Actor ID
            run_id: Run ID to wait for
            timeout_secs: Maximum time to wait
            poll_interval: Seconds between status checks

        Returns:
            Run result with status and dataset_id
        """
        import time

        start_time = time.time()
        endpoint = f"acts/{actor_id}/runs/{run_id}"

        while True:
            if time.time() - start_time > timeout_secs:
                return {
                    "status": "error",
                    "message": "Actor run timed out",
                }

            try:
                response = await self._make_request("GET", endpoint, timeout=30.0)
                run_data = response.get("data", {})
                status = run_data.get("status")

                if status == "SUCCEEDED":
                    return {
                        "status": "success",
                        "run_id": run_id,
                        "dataset_id": run_data.get("defaultDatasetId"),
                    }
                elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
                    return {
                        "status": "error",
                        "message": f"Actor run failed with status: {status}",
                    }

                # Still running, wait and poll again
                await asyncio.sleep(poll_interval)

            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Error checking run status: {str(e)}",
                }

    async def _get_dataset_items(
        self,
        dataset_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get items from an Apify dataset.

        Args:
            dataset_id: Dataset ID
            limit: Maximum items to retrieve

        Returns:
            List of dataset items
        """
        endpoint = f"datasets/{dataset_id}/items"
        params = {"limit": limit}

        response = await self._make_request(
            "GET",
            endpoint,
            params=params,
            timeout=60.0,
        )

        # Response is a list of items directly
        if isinstance(response, list):
            return response

        return response.get("data", response.get("items", []))

    def _transform_harvestapi_profile(self, profile: dict[str, Any]) -> dict[str, Any] | None:
        """Transform HarvestAPI profile data to standardized format.

        HarvestAPI returns profiles with fields like:
        - publicIdentifier, linkedinUrl
        - firstName, lastName, fullName
        - headline, location
        - currentPositions, pastPositions
        - skills, education
        - email (if email mode enabled)

        Args:
            profile: Raw profile data from HarvestAPI actor

        Returns:
            Standardized person data or None if invalid
        """
        if not profile:
            return None

        # Extract basic info
        first_name = profile.get("firstName", "")
        last_name = profile.get("lastName", "")
        full_name = profile.get("fullName", f"{first_name} {last_name}".strip())

        # Parse name if only fullName provided
        if not first_name and full_name:
            parts = full_name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        # Get profile URL
        profile_url = profile.get("linkedinUrl", "")
        if not profile_url and profile.get("publicIdentifier"):
            profile_url = f"https://www.linkedin.com/in/{profile.get('publicIdentifier')}"

        # Extract current position
        current_title = ""
        current_company = ""
        current_positions = profile.get("currentPositions", [])
        if current_positions and len(current_positions) > 0:
            current_pos = current_positions[0]
            current_title = current_pos.get("title", "")
            current_company = current_pos.get("companyName", "")

        # Fallback to headline for title
        headline = profile.get("headline", "")
        if not current_title and headline:
            # Try to extract title from headline (often "Title at Company")
            if " at " in headline:
                current_title = headline.split(" at ")[0].strip()
            else:
                current_title = headline

        # Extract location
        location = profile.get("location", "")
        if isinstance(location, dict):
            location = location.get("default", location.get("city", ""))

        # Extract skills
        skills = []
        skills_data = profile.get("skills", [])
        if skills_data:
            for skill in skills_data:
                if isinstance(skill, dict):
                    skill_name = skill.get("name", skill.get("skill", ""))
                    if skill_name:
                        skills.append(skill_name)
                elif isinstance(skill, str):
                    skills.append(skill)

        # Calculate experience years from positions
        experience_years = self._calculate_experience_years(profile)

        # Get email if available
        email = (
            profile.get("email") or profile.get("emails", [None])[0]
            if profile.get("emails")
            else None
        )

        # Get summary/about
        summary = profile.get("summary", profile.get("about", ""))

        return {
            "name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "title": current_title,
            "company": current_company,
            "location": location,
            "profile_url": profile_url,
            "platform": "linkedin",
            "skills": skills[:20] if skills else [],
            "experience_years": experience_years,
            "headline": headline or current_title,
            "summary": summary,
            "phone": profile.get("phone"),
            "raw_data": {
                "linkedin_id": profile.get("id") or profile.get("publicIdentifier"),
                "connections": profile.get("connectionsCount"),
                "profile_picture": profile.get("profilePicture") or profile.get("photo"),
                "industry": profile.get("industry"),
                "education": profile.get("education", []),
                "certifications": profile.get("certifications", []),
                "current_positions": current_positions,
                "past_positions": profile.get("pastPositions", []),
            },
        }

    def _calculate_experience_years(self, profile: dict[str, Any]) -> int | None:
        """Calculate years of experience from position history.

        Args:
            profile: Profile data with positions

        Returns:
            Estimated years of experience or None
        """
        import re
        from datetime import datetime

        all_positions = profile.get("currentPositions", []) + profile.get("pastPositions", [])

        if not all_positions:
            return None

        earliest_year = None
        for position in all_positions:
            start_date = position.get("startDate", position.get("start", ""))

            # Handle various date formats
            if isinstance(start_date, dict):
                year = start_date.get("year")
                if year:
                    earliest_year = min(earliest_year or year, year)
            elif isinstance(start_date, str) and start_date:
                # Try to extract year from string
                year_match = re.search(r"(19|20)\d{2}", start_date)
                if year_match:
                    year = int(year_match.group())
                    earliest_year = min(earliest_year or year, year)

        if earliest_year:
            return datetime.now().year - earliest_year

        return None

    async def enrich_profile(
        self,
        linkedin_url: str,
    ) -> dict[str, Any]:
        """Enrich a LinkedIn profile with additional data.

        Args:
            linkedin_url: LinkedIn profile URL

        Returns:
            Enriched profile data
        """
        if not self.api_token:
            return {
                "status": "error",
                "message": "Apify API token not configured",
                "person": None,
            }

        actor_input = {
            "profileUrls": [linkedin_url],
            "mode": "full",
        }

        try:
            run_result = await self._run_actor(
                actor_id=self.LINKEDIN_PROFILE_ACTOR,
                run_input=actor_input,
            )

            if run_result.get("status") != "success":
                return {
                    "status": "error",
                    "message": run_result.get("message", "Failed to enrich profile"),
                    "person": None,
                }

            dataset_id = run_result.get("dataset_id")
            if not dataset_id:
                return {
                    "status": "not_found",
                    "message": "No profile data returned",
                    "person": None,
                }

            results = await self._get_dataset_items(dataset_id, limit=1)

            if results:
                return {
                    "status": "success",
                    "person": self._transform_harvestapi_profile(results[0]),
                    "raw_response": results[0],
                }
            else:
                return {
                    "status": "not_found",
                    "message": "Profile not found",
                    "person": None,
                }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Profile enrichment failed: {str(e)}",
                "person": None,
            }


# Create singleton instance
apify = ApifyService()
