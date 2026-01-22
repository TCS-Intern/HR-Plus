"""GitHub API integration for candidate sourcing."""

import asyncio
from typing import Any

import httpx


class GitHubSearchService:
    """Service for searching GitHub users as potential candidates.

    Uses the public GitHub API (no authentication required for basic search),
    but authenticated requests have higher rate limits.

    Rate limits:
    - Unauthenticated: 10 requests/minute for search, 60 requests/hour for other endpoints
    - Authenticated: 30 requests/minute for search, 5000 requests/hour for other endpoints
    """

    BASE_URL = "https://api.github.com"

    # Rate limiting for unauthenticated requests
    RATE_LIMIT_REQUESTS = 10
    RATE_LIMIT_WINDOW = 60  # seconds

    def __init__(self, token: str | None = None) -> None:
        """Initialize the GitHub search service.

        Args:
            token: Optional GitHub personal access token for higher rate limits
        """
        self.token = token
        self._request_timestamps: list[float] = []

    @property
    def _headers(self) -> dict[str, str]:
        """Get request headers."""
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def _rate_limit(self) -> None:
        """Implement rate limiting to avoid API throttling."""
        import time

        now = time.time()
        # Remove timestamps older than the rate limit window
        self._request_timestamps = [
            ts for ts in self._request_timestamps if now - ts < self.RATE_LIMIT_WINDOW
        ]

        limit = 30 if self.token else self.RATE_LIMIT_REQUESTS
        if len(self._request_timestamps) >= limit:
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
        """Make a GET request to GitHub API.

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

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                headers=self._headers,
                params=params,
            )
            response.raise_for_status()
            return response.json()

    async def search_users(
        self,
        query: str | None = None,
        location: str | None = None,
        language: str | None = None,
        repos_min: int | None = None,
        followers_min: int | None = None,
        page: int = 1,
        per_page: int = 30,
    ) -> dict[str, Any]:
        """Search for GitHub users matching criteria.

        Args:
            query: General search query (searches username, name, email, bio)
            location: Location filter (e.g., "San Francisco", "California", "USA")
            language: Primary programming language
            repos_min: Minimum number of public repositories
            followers_min: Minimum number of followers
            page: Page number for pagination
            per_page: Results per page (max 100)

        Returns:
            Dictionary containing:
            - users: List of matching user profiles
            - pagination: Pagination info
        """
        # Build search query string
        query_parts = []

        if query:
            query_parts.append(query)
        if location:
            query_parts.append(f'location:"{location}"')
        if language:
            query_parts.append(f"language:{language}")
        if repos_min:
            query_parts.append(f"repos:>={repos_min}")
        if followers_min:
            query_parts.append(f"followers:>={followers_min}")

        # Default to searching for developers with some activity
        if not query_parts:
            query_parts.append("repos:>=5")

        search_query = " ".join(query_parts)

        try:
            response = await self._make_request(
                "search/users",
                params={
                    "q": search_query,
                    "page": page,
                    "per_page": min(per_page, 100),
                    "sort": "followers",
                    "order": "desc",
                },
            )

            users = response.get("items", [])
            total_count = response.get("total_count", 0)

            # Fetch additional details for each user (in parallel with rate limiting)
            enriched_users = []
            for user in users[:per_page]:  # Limit to avoid rate limiting
                enriched = await self.get_user_profile(user.get("login", ""))
                if enriched.get("status") == "success":
                    enriched_users.append(enriched["profile"])
                else:
                    # Fall back to basic info from search
                    enriched_users.append(self._transform_search_result(user))

            return {
                "status": "success",
                "users": enriched_users,
                "pagination": {
                    "total": min(total_count, 1000),  # GitHub limits to 1000 results
                    "page": page,
                    "per_page": per_page,
                    "total_pages": min((total_count + per_page - 1) // per_page, 34),
                },
                "search_query": search_query,
            }

        except httpx.HTTPStatusError as e:
            error_message = f"GitHub API error: {e.response.status_code}"
            if e.response.status_code == 403:
                error_message = "GitHub API rate limit exceeded. Please try again later."
            elif e.response.status_code == 422:
                error_message = f"Invalid search query: {search_query}"

            return {
                "status": "error",
                "message": error_message,
                "users": [],
                "pagination": {"total": 0, "page": page, "per_page": per_page},
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"GitHub search failed: {str(e)}",
                "users": [],
                "pagination": {"total": 0, "page": page, "per_page": per_page},
            }

    async def get_user_profile(self, username: str) -> dict[str, Any]:
        """Get detailed profile for a GitHub user.

        Args:
            username: GitHub username

        Returns:
            Dictionary with user profile data
        """
        if not username:
            return {
                "status": "error",
                "message": "Username is required",
                "profile": None,
            }

        try:
            # Get user profile
            user_data = await self._make_request(f"users/{username}")

            # Get user's repositories to infer skills
            repos_response = await self._make_request(
                f"users/{username}/repos",
                params={"per_page": 100, "sort": "pushed"},
            )

            # Extract languages from repos
            languages = {}
            for repo in repos_response:
                lang = repo.get("language")
                if lang:
                    languages[lang] = languages.get(lang, 0) + 1

            # Sort languages by frequency
            top_languages = sorted(languages.items(), key=lambda x: x[1], reverse=True)
            skills = [lang for lang, _ in top_languages[:10]]

            # Transform to standardized format
            profile = self._transform_user_profile(user_data, skills, repos_response)

            return {
                "status": "success",
                "profile": profile,
            }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {
                    "status": "not_found",
                    "message": f"User '{username}' not found",
                    "profile": None,
                }
            return {
                "status": "error",
                "message": f"GitHub API error: {e.response.status_code}",
                "profile": None,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to get profile: {str(e)}",
                "profile": None,
            }

    async def search_by_skills(
        self,
        skills: list[str],
        location: str | None = None,
        page: int = 1,
        per_page: int = 30,
    ) -> dict[str, Any]:
        """Search for GitHub users by programming skills/languages.

        Args:
            skills: List of programming languages or technologies
            location: Optional location filter
            page: Page number
            per_page: Results per page

        Returns:
            Dictionary with search results
        """
        # GitHub user search only supports one language at a time
        # Search for the primary skill and use others as general query
        primary_language = None
        other_skills = []

        for skill in skills:
            # Common programming languages
            if skill.lower() in [
                "python",
                "javascript",
                "typescript",
                "java",
                "go",
                "rust",
                "c",
                "c++",
                "c#",
                "ruby",
                "php",
                "swift",
                "kotlin",
                "scala",
                "r",
                "matlab",
                "perl",
                "shell",
                "bash",
                "powershell",
            ]:
                if not primary_language:
                    primary_language = skill
                else:
                    other_skills.append(skill)
            else:
                other_skills.append(skill)

        # Build query from non-language skills
        query = " ".join(other_skills) if other_skills else None

        return await self.search_users(
            query=query,
            location=location,
            language=primary_language,
            repos_min=5,  # Filter for active developers
            page=page,
            per_page=per_page,
        )

    def _transform_search_result(self, user: dict[str, Any]) -> dict[str, Any]:
        """Transform GitHub search result to standardized format.

        Args:
            user: Raw user data from search API

        Returns:
            Standardized user data
        """
        return {
            "name": user.get("login", ""),
            "first_name": "",
            "last_name": "",
            "email": None,
            "title": "Software Developer",
            "company": "",
            "location": "",
            "profile_url": user.get("html_url", ""),
            "platform": "github",
            "skills": [],
            "experience_years": None,
            "headline": "",
            "summary": "",
            "raw_data": {
                "github_id": user.get("id"),
                "login": user.get("login"),
                "avatar_url": user.get("avatar_url"),
                "score": user.get("score"),
            },
        }

    def _transform_user_profile(
        self,
        user: dict[str, Any],
        skills: list[str],
        repos: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Transform GitHub user profile to standardized format.

        Args:
            user: Raw user data from user API
            skills: Extracted skills from repos
            repos: User's repositories

        Returns:
            Standardized user data
        """
        name = user.get("name", "") or user.get("login", "")
        name_parts = name.split(" ", 1) if name else ["", ""]
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Extract company (remove @ prefix if present)
        company = user.get("company", "") or ""
        if company.startswith("@"):
            company = company[1:]

        # Estimate experience from account age and activity
        experience_years = self._estimate_experience(user, repos)

        # Build headline from bio or generate one
        bio = user.get("bio", "") or ""
        headline = bio if bio else f"Developer with {user.get('public_repos', 0)} public repos"

        return {
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "email": user.get("email"),  # May be None if not public
            "title": self._infer_title(skills, repos),
            "company": company,
            "location": user.get("location", "") or "",
            "profile_url": user.get("html_url", ""),
            "platform": "github",
            "skills": skills,
            "experience_years": experience_years,
            "headline": headline,
            "summary": bio,
            "raw_data": {
                "github_id": user.get("id"),
                "login": user.get("login"),
                "avatar_url": user.get("avatar_url"),
                "public_repos": user.get("public_repos", 0),
                "public_gists": user.get("public_gists", 0),
                "followers": user.get("followers", 0),
                "following": user.get("following", 0),
                "created_at": user.get("created_at"),
                "updated_at": user.get("updated_at"),
                "blog": user.get("blog"),
                "twitter_username": user.get("twitter_username"),
                "hireable": user.get("hireable"),
            },
        }

    def _estimate_experience(
        self,
        user: dict[str, Any],
        repos: list[dict[str, Any]],
    ) -> int | None:
        """Estimate years of experience from GitHub activity.

        Args:
            user: User profile data
            repos: User's repositories

        Returns:
            Estimated years of experience or None
        """
        try:
            from datetime import datetime

            created_at = user.get("created_at")
            if not created_at:
                return None

            # Parse ISO format date
            if isinstance(created_at, str):
                account_created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                years_on_github = (
                    datetime.now(account_created.tzinfo) - account_created
                ).days // 365

                # Estimate: assume ~1-2 years experience before creating GitHub
                # Adjust based on activity level
                if user.get("public_repos", 0) > 50:
                    years_on_github += 2
                elif user.get("public_repos", 0) > 20:
                    years_on_github += 1

                return max(1, years_on_github)

        except (ValueError, TypeError):
            pass

        return None

    def _infer_title(
        self,
        skills: list[str],
        repos: list[dict[str, Any]],
    ) -> str:
        """Infer a job title from skills and repos.

        Args:
            skills: List of programming languages/technologies
            repos: User's repositories

        Returns:
            Inferred job title
        """
        if not skills:
            return "Software Developer"

        primary_skill = skills[0].lower()

        # Map languages to common titles
        title_map = {
            "python": "Python Developer",
            "javascript": "JavaScript Developer",
            "typescript": "Full Stack Developer",
            "java": "Java Developer",
            "go": "Go Developer",
            "rust": "Rust Developer",
            "c++": "C++ Developer",
            "c#": ".NET Developer",
            "ruby": "Ruby Developer",
            "php": "PHP Developer",
            "swift": "iOS Developer",
            "kotlin": "Android Developer",
            "scala": "Scala Developer",
        }

        # Check for specific patterns in repos
        repo_names = [r.get("name", "").lower() for r in repos[:20]]
        repo_descriptions = [
            r.get("description", "").lower() for r in repos[:20] if r.get("description")
        ]

        all_text = " ".join(repo_names + repo_descriptions)

        if "machine learning" in all_text or "ml" in all_text or "tensorflow" in all_text:
            return "Machine Learning Engineer"
        if "frontend" in all_text or "react" in all_text or "vue" in all_text:
            return "Frontend Developer"
        if "backend" in all_text or "api" in all_text:
            return "Backend Developer"
        if "devops" in all_text or "kubernetes" in all_text or "docker" in all_text:
            return "DevOps Engineer"
        if "data" in all_text and ("science" in all_text or "analysis" in all_text):
            return "Data Scientist"

        return title_map.get(primary_skill, "Software Developer")


# Create singleton instance with optional token from settings
def _create_github_search() -> GitHubSearchService:
    """Create GitHub search service with token from settings if available."""
    try:
        from app.config import settings

        token = settings.github_token if settings.github_token else None
        return GitHubSearchService(token=token)
    except Exception:
        # If settings not available, use unauthenticated access
        return GitHubSearchService()


github_search = _create_github_search()
