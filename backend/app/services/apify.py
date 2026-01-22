"""Apify API integration for LinkedIn candidate sourcing."""

import asyncio
import re
from typing import Any

import httpx

from app.config import settings


class ApifyService:
    """Service for interacting with Apify API to run LinkedIn scrapers.

    Uses a two-step approach:
    1. Google Search to find LinkedIn profile URLs
    2. LinkedIn Profile Detail scraper to enrich profiles
    """

    BASE_URL = "https://api.apify.com/v2"

    # Google Search for finding LinkedIn profiles
    GOOGLE_SEARCH_ACTOR = "apify~google-search-scraper"

    # LinkedIn Profile Detail scraper (no cookies required)
    LINKEDIN_PROFILE_ACTOR = "apimaestro~linkedin-profile-detail"

    # Rate limiting: Apify has 60 requests/second per resource
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
            ts for ts in self._request_timestamps
            if now - ts < self.RATE_LIMIT_WINDOW
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
        enrich_profiles: bool = True,
    ) -> dict[str, Any]:
        """Search for people on LinkedIn using Google Search + Profile enrichment.

        Two-step approach:
        1. Use Google Search to find LinkedIn profile URLs
        2. Use LinkedIn Profile Detail scraper to get full profile data

        Args:
            job_titles: List of job titles to search for
            skills: List of skills to filter by
            locations: List of locations (cities, countries)
            companies: List of company names to filter by
            keywords: Additional search keywords
            limit: Maximum results to return
            enrich_profiles: Whether to fetch full profile details (slower but more data)

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

        # Step 1: Build Google search query
        search_parts = ["site:linkedin.com/in"]

        if job_titles:
            search_parts.append(" OR ".join(f'"{title}"' for title in job_titles))

        if skills:
            search_parts.append(" ".join(skills))

        if locations:
            search_parts.append(" OR ".join(locations))

        if companies:
            search_parts.append(" OR ".join(f'"{company}"' for company in companies))

        if keywords:
            search_parts.append(keywords)

        google_query = " ".join(search_parts)

        try:
            # Run Google Search to find LinkedIn URLs
            google_result = await self._run_actor(
                actor_id=self.GOOGLE_SEARCH_ACTOR,
                run_input={
                    "queries": google_query,
                    "maxPagesPerQuery": max(1, limit // 10),
                    "resultsPerPage": min(limit, 100),
                },
            )

            if google_result.get("status") != "success":
                return {
                    "status": "error",
                    "message": f"Google search failed: {google_result.get('message')}",
                    "people": [],
                }

            # Extract LinkedIn URLs from Google results
            dataset_id = google_result.get("dataset_id")
            if not dataset_id:
                return {
                    "status": "error",
                    "message": "No results from Google search",
                    "people": [],
                }

            google_items = await self._get_dataset_items(dataset_id, limit=1)
            linkedin_urls = []

            for item in google_items:
                organic_results = item.get("organicResults", [])
                for result in organic_results:
                    url = result.get("url", "")
                    title = result.get("title", "")
                    if "linkedin.com/in/" in url and url not in linkedin_urls:
                        linkedin_urls.append(url)
                        if len(linkedin_urls) >= limit:
                            break
                if len(linkedin_urls) >= limit:
                    break

            if not linkedin_urls:
                return {
                    "status": "success",
                    "people": [],
                    "total": 0,
                    "message": "No LinkedIn profiles found",
                }

            # Step 2: Enrich profiles if requested
            if enrich_profiles and linkedin_urls:
                profile_result = await self._run_actor(
                    actor_id=self.LINKEDIN_PROFILE_ACTOR,
                    run_input={
                        "profileUrls": linkedin_urls[:limit],
                    },
                )

                if profile_result.get("status") == "success":
                    profile_dataset_id = profile_result.get("dataset_id")
                    if profile_dataset_id:
                        profiles = await self._get_dataset_items(profile_dataset_id, limit=limit)

                        # Transform enriched results
                        people = []
                        for profile in profiles:
                            people.append(self._transform_linkedin_person(profile))

                        return {
                            "status": "success",
                            "people": people,
                            "total": len(people),
                        }

            # Fallback: return basic info from Google search
            people = []
            for item in google_items:
                for result in item.get("organicResults", []):
                    url = result.get("url", "")
                    if "linkedin.com/in/" in url:
                        # Extract name from title (usually "Name - Title | LinkedIn")
                        title = result.get("title", "")
                        name_match = re.match(r"^([^-|]+)", title)
                        name = name_match.group(1).strip() if name_match else ""
                        name_parts = name.split(" ", 1)

                        people.append({
                            "name": name,
                            "first_name": name_parts[0] if name_parts else "",
                            "last_name": name_parts[1] if len(name_parts) > 1 else "",
                            "headline": result.get("description", ""),
                            "profile_url": url,
                            "platform": "linkedin",
                            "title": "",
                            "company": "",
                            "location": "",
                            "skills": [],
                            "experience_years": None,
                            "raw_data": {"source": "google_search"},
                        })

                        if len(people) >= limit:
                            break

            return {
                "status": "success",
                "people": people,
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
            actor_id: Actor ID (e.g., "username/actor-name")
            run_input: Input parameters for the actor
            wait_for_finish: Whether to wait for the actor to complete
            timeout_secs: Timeout for waiting

        Returns:
            Run result with status and dataset_id
        """
        # Start the actor run
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

    def _transform_linkedin_person(self, person: dict[str, Any]) -> dict[str, Any]:
        """Transform LinkedIn profile data to standardized format.

        Handles both apimaestro format (with basic_info nested) and flat formats.

        Args:
            person: Raw person data from Apify scraper

        Returns:
            Standardized person data matching the SourceSearchResultItem schema
        """
        # Handle apimaestro format (has basic_info nested structure)
        basic_info = person.get("basic_info", {})
        if basic_info:
            # apimaestro format
            full_name = basic_info.get("fullname", "")
            first_name = basic_info.get("first_name", "")
            last_name = basic_info.get("last_name", "")
            headline = basic_info.get("headline", "")
            profile_url = basic_info.get("profile_url", "")

            # Location handling
            location_info = basic_info.get("location", {})
            if isinstance(location_info, dict):
                location = location_info.get("full", "")
            else:
                location = str(location_info) if location_info else ""

            current_company = basic_info.get("current_company", "")
            current_title = headline.split(" at ")[0] if " at " in headline else headline

            # Skills from top_skills
            skills = basic_info.get("top_skills", [])
            if not skills:
                skills = person.get("skills", [])

            # Experience from work history
            experiences = person.get("experience", [])

        else:
            # Flat format handling
            full_name = person.get("name", person.get("fullName", ""))
            first_name = person.get("firstName", "")
            last_name = person.get("lastName", "")
            headline = person.get("headline", "")
            profile_url = person.get("profileUrl", person.get("linkedinUrl", person.get("url", "")))
            location = person.get("location", person.get("locationName", ""))
            current_company = person.get("company", person.get("currentCompany", ""))
            current_title = person.get("title", headline)
            skills = person.get("skills", [])
            experiences = person.get("experience", person.get("positions", []))

        # Parse name if needed
        if not first_name and full_name:
            parts = full_name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        # Try to extract position from experience list
        if experiences and isinstance(experiences, list) and len(experiences) > 0:
            current_exp = experiences[0]
            if not current_title or current_title == headline:
                current_title = current_exp.get("title", current_exp.get("position", current_title))
            if not current_company:
                current_company = current_exp.get("company", current_exp.get("companyName", ""))

        # Handle skills format
        if isinstance(skills, list) and len(skills) > 0:
            if isinstance(skills[0], dict):
                skills = [s.get("name", s.get("skill", "")) for s in skills]
            skills = [s for s in skills if s]

        # Calculate experience years
        experience_years = None
        if experiences:
            try:
                from datetime import datetime
                earliest_year = None
                for exp in experiences:
                    start_date = exp.get("startDate", exp.get("dateRange", exp.get("start_date", "")))
                    if isinstance(start_date, str) and start_date:
                        year_match = re.search(r'(19|20)\d{2}', start_date)
                        if year_match:
                            year = int(year_match.group())
                            if earliest_year is None or year < earliest_year:
                                earliest_year = year
                if earliest_year:
                    experience_years = datetime.now().year - earliest_year
            except (ValueError, TypeError):
                pass

        # Build profile URL if not set
        if not profile_url:
            public_id = person.get("publicIdentifier", basic_info.get("public_identifier", ""))
            if public_id:
                profile_url = f"https://www.linkedin.com/in/{public_id}"
        if not profile_url and person.get("publicIdentifier"):
            profile_url = f"https://www.linkedin.com/in/{person.get('publicIdentifier')}"

        # Extract email and about from various formats
        email = person.get("email") or basic_info.get("email")
        about = person.get("summary") or person.get("about") or basic_info.get("about", "")
        phone = person.get("phone") or person.get("phoneNumber")

        # Get connection/follower counts
        connections = (
            basic_info.get("connection_count")
            or basic_info.get("follower_count")
            or person.get("connections")
            or person.get("connectionCount")
        )

        return {
            "name": full_name or f"{first_name} {last_name}".strip(),
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
            "summary": about,
            "phone": phone,
            "raw_data": {
                "linkedin_id": person.get("id") or basic_info.get("urn") or basic_info.get("public_identifier"),
                "connections": connections,
                "profile_picture": basic_info.get("profile_picture_url") or person.get("profilePicture") or person.get("photo"),
                "industry": person.get("industry"),
                "education": person.get("education", []),
                "certifications": person.get("certifications", []),
                "is_premium": basic_info.get("is_premium", False),
                "is_influencer": basic_info.get("is_influencer", False),
            },
        }

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

        # Use apimaestro LinkedIn Profile Detail scraper for enrichment
        actor_input = {
            "profileUrls": [linkedin_url],
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
                    "person": self._transform_linkedin_person(results[0]),
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
