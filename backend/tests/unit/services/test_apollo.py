"""Unit tests for Apollo.io service integration."""

import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.apollo import ApolloService


# ==================== Mock Data ====================


def mock_apollo_person() -> dict:
    """Generate a realistic Apollo person response."""
    return {
        "id": "apollo-123",
        "name": "Jane Smith",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane.smith@techcorp.com",
        "email_status": "verified",
        "title": "Senior Software Engineer",
        "headline": "Senior Software Engineer at TechCorp",
        "seniority": "senior",
        "departments": ["engineering"],
        "organization_name": "TechCorp",
        "organization": {
            "id": "org-456",
            "name": "TechCorp",
        },
        "city": "San Francisco",
        "state": "California",
        "country": "United States",
        "linkedin_url": "https://linkedin.com/in/janesmith",
        "photo_url": "https://example.com/photo.jpg",
        "technologies": ["Python", "FastAPI", "PostgreSQL"],
        "keywords": ["distributed systems", "microservices"],
        "phone_numbers": [{"number": "+1-555-987-6543"}],
        "employment_history": [
            {
                "title": "Senior Software Engineer",
                "organization_name": "TechCorp",
                "start_date": "2020-01-01",
            },
            {
                "title": "Software Engineer",
                "organization_name": "StartupCo",
                "start_date": "2017-06-01",
            },
        ],
    }


def mock_apollo_search_response() -> dict:
    """Generate a mock Apollo search API response."""
    return {
        "people": [mock_apollo_person()],
        "pagination": {
            "total_entries": 150,
            "page": 1,
            "per_page": 25,
            "total_pages": 6,
        },
    }


# ==================== ApolloService Tests ====================


class TestApolloServiceInit:
    """Test ApolloService initialization and configuration."""

    @patch("app.services.apollo.settings")
    def test_init_with_api_key(self, mock_settings):
        mock_settings.apollo_api_key = "test-api-key"
        service = ApolloService()
        assert service.api_key == "test-api-key"

    @patch("app.services.apollo.settings")
    def test_init_without_api_key(self, mock_settings):
        mock_settings.apollo_api_key = ""
        service = ApolloService()
        assert service.api_key == ""

    @patch("app.services.apollo.settings")
    def test_headers_include_api_key(self, mock_settings):
        mock_settings.apollo_api_key = "my-key"
        service = ApolloService()
        headers = service._headers
        assert headers["X-Api-Key"] == "my-key"
        assert headers["Content-Type"] == "application/json"
        assert headers["Cache-Control"] == "no-cache"


class TestApolloSearchPeople:
    """Test the search_people method."""

    @pytest.fixture
    def service(self):
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = "test-key"
            svc = ApolloService()
        return svc

    @pytest.mark.asyncio
    async def test_search_people_success(self, service):
        """Test successful people search."""
        mock_response = mock_apollo_search_response()

        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response

            result = await service.search_people(
                job_titles=["Software Engineer"],
                skills=["Python", "FastAPI"],
                locations=["San Francisco"],
                per_page=25,
            )

        assert result["status"] == "success"
        assert len(result["people"]) == 1
        assert result["people"][0]["name"] == "Jane Smith"
        assert result["people"][0]["email"] == "jane.smith@techcorp.com"
        assert result["pagination"]["total"] == 150
        assert result["pagination"]["total_pages"] == 6

        # Verify request was made with correct params
        mock_req.assert_called_once_with(
            "POST",
            "mixed_people/search",
            data={
                "page": 1,
                "per_page": 25,
                "person_titles": ["Software Engineer"],
                "q_keywords": "Python FastAPI",
                "person_locations": ["San Francisco"],
            },
        )

    @pytest.mark.asyncio
    async def test_search_people_no_api_key(self):
        """Test search returns error when API key is not configured."""
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = ""
            service = ApolloService()

        result = await service.search_people(job_titles=["Engineer"])

        assert result["status"] == "error"
        assert "not configured" in result["message"]
        assert result["people"] == []
        assert result["pagination"]["total"] == 0

    @pytest.mark.asyncio
    async def test_search_people_empty_results(self, service):
        """Test search with no matching results."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"people": [], "pagination": {}}

            result = await service.search_people(job_titles=["Nonexistent Role"])

        assert result["status"] == "success"
        assert result["people"] == []

    @pytest.mark.asyncio
    async def test_search_people_with_seniority_and_company(self, service):
        """Test search with all optional filters."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_apollo_search_response()

            await service.search_people(
                job_titles=["Engineer"],
                skills=["Python"],
                locations=["NYC"],
                person_seniorities=["senior", "manager"],
                current_company_keywords=["Google"],
                page=2,
                per_page=50,
            )

        call_data = mock_req.call_args[1]["data"]
        assert call_data["person_seniorities"] == ["senior", "manager"]
        assert call_data["q_organization_keyword_tags"] == ["Google"]
        assert call_data["page"] == 2
        assert call_data["per_page"] == 50

    @pytest.mark.asyncio
    async def test_search_people_caps_per_page_at_100(self, service):
        """Test that per_page is capped at 100."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_apollo_search_response()

            await service.search_people(per_page=200)

        call_data = mock_req.call_args[1]["data"]
        assert call_data["per_page"] == 100

    @pytest.mark.asyncio
    async def test_search_people_http_error(self, service):
        """Test search handles HTTP errors gracefully."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            response = httpx.Response(429, text="Rate limit exceeded")
            mock_req.side_effect = httpx.HTTPStatusError(
                "Rate limited", request=httpx.Request("POST", "http://test"), response=response
            )

            result = await service.search_people(job_titles=["Engineer"])

        assert result["status"] == "error"
        assert "429" in result["message"]
        assert result["people"] == []

    @pytest.mark.asyncio
    async def test_search_people_generic_exception(self, service):
        """Test search handles unexpected exceptions."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("Connection timeout")

            result = await service.search_people(job_titles=["Engineer"])

        assert result["status"] == "error"
        assert "Connection timeout" in result["message"]
        assert result["people"] == []

    @pytest.mark.asyncio
    async def test_search_people_minimal_params(self, service):
        """Test search with no optional filters sends only pagination."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"people": [], "pagination": {}}

            await service.search_people()

        call_data = mock_req.call_args[1]["data"]
        assert call_data == {"page": 1, "per_page": 25}


class TestApolloEnrichPerson:
    """Test the enrich_person method."""

    @pytest.fixture
    def service(self):
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = "test-key"
            svc = ApolloService()
        return svc

    @pytest.mark.asyncio
    async def test_enrich_by_email(self, service):
        """Test enrichment by email address."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": mock_apollo_person()}

            result = await service.enrich_person(email="jane@techcorp.com")

        assert result["status"] == "success"
        assert result["person"]["name"] == "Jane Smith"
        mock_req.assert_called_once_with("POST", "people/match", data={"email": "jane@techcorp.com"})

    @pytest.mark.asyncio
    async def test_enrich_by_linkedin_url(self, service):
        """Test enrichment by LinkedIn URL."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": mock_apollo_person()}

            result = await service.enrich_person(linkedin_url="https://linkedin.com/in/janesmith")

        assert result["status"] == "success"
        call_data = mock_req.call_args[1]["data"]
        assert call_data["linkedin_url"] == "https://linkedin.com/in/janesmith"

    @pytest.mark.asyncio
    async def test_enrich_by_name_and_company(self, service):
        """Test enrichment by name + company."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": mock_apollo_person()}

            result = await service.enrich_person(
                first_name="Jane",
                last_name="Smith",
                organization_name="TechCorp",
            )

        assert result["status"] == "success"
        call_data = mock_req.call_args[1]["data"]
        assert call_data == {
            "first_name": "Jane",
            "last_name": "Smith",
            "organization_name": "TechCorp",
        }

    @pytest.mark.asyncio
    async def test_enrich_no_identifiers(self, service):
        """Test enrichment fails without any identifiers."""
        result = await service.enrich_person()

        assert result["status"] == "error"
        assert "identifier" in result["message"].lower()
        assert result["person"] is None

    @pytest.mark.asyncio
    async def test_enrich_not_found(self, service):
        """Test enrichment when person is not found."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": None}

            result = await service.enrich_person(email="nobody@nowhere.com")

        assert result["status"] == "not_found"
        assert result["person"] is None

    @pytest.mark.asyncio
    async def test_enrich_no_api_key(self):
        """Test enrichment without API key returns error."""
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = ""
            service = ApolloService()

        result = await service.enrich_person(email="test@test.com")

        assert result["status"] == "error"
        assert "not configured" in result["message"]

    @pytest.mark.asyncio
    async def test_enrich_http_error(self, service):
        """Test enrichment handles HTTP errors."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            response = httpx.Response(401, text="Unauthorized")
            mock_req.side_effect = httpx.HTTPStatusError(
                "Unauthorized", request=httpx.Request("POST", "http://test"), response=response
            )

            result = await service.enrich_person(email="test@test.com")

        assert result["status"] == "error"
        assert "401" in result["message"]


class TestApolloFindEmail:
    """Test the find_email method."""

    @pytest.fixture
    def service(self):
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = "test-key"
            svc = ApolloService()
        return svc

    @pytest.mark.asyncio
    async def test_find_email_success_verified(self, service):
        """Test finding a verified email."""
        person = mock_apollo_person()
        person["email_status"] = "verified"

        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": person}

            result = await service.find_email(
                first_name="Jane",
                last_name="Smith",
                organization_name="TechCorp",
            )

        assert result["status"] == "success"
        assert result["email"] == "jane.smith@techcorp.com"
        assert result["confidence"] == "high"
        assert result["email_status"] == "verified"

    @pytest.mark.asyncio
    async def test_find_email_unverified(self, service):
        """Test finding an unverified email returns medium confidence."""
        person = mock_apollo_person()
        person["email_status"] = "guessed"

        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": person}

            result = await service.find_email(
                first_name="Jane",
                last_name="Smith",
                domain="techcorp.com",
            )

        assert result["status"] == "success"
        assert result["confidence"] == "medium"

    @pytest.mark.asyncio
    async def test_find_email_not_found(self, service):
        """Test email not found."""
        person = mock_apollo_person()
        person["email"] = None

        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"person": person}

            result = await service.find_email(
                first_name="Jane",
                last_name="Smith",
                organization_name="TechCorp",
            )

        assert result["status"] == "not_found"
        assert result["email"] is None

    @pytest.mark.asyncio
    async def test_find_email_missing_company_and_domain(self, service):
        """Test find_email fails without company or domain."""
        result = await service.find_email(first_name="Jane", last_name="Smith")

        assert result["status"] == "error"
        assert "organization_name or domain" in result["message"]

    @pytest.mark.asyncio
    async def test_find_email_no_api_key(self):
        """Test find_email without API key."""
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = ""
            service = ApolloService()

        result = await service.find_email(
            first_name="Jane", last_name="Smith", organization_name="TechCorp"
        )

        assert result["status"] == "error"
        assert "not configured" in result["message"]

    @pytest.mark.asyncio
    async def test_find_email_with_domain(self, service):
        """Test find_email sends domain in request."""
        with patch.object(service, "_make_request", new_callable=AsyncMock) as mock_req:
            person = mock_apollo_person()
            mock_req.return_value = {"person": person}

            await service.find_email(
                first_name="Jane",
                last_name="Smith",
                domain="techcorp.com",
            )

        call_data = mock_req.call_args[1]["data"]
        assert call_data["domain"] == "techcorp.com"
        assert "organization_name" not in call_data


class TestApolloTransformPerson:
    """Test the _transform_person data transformation."""

    @pytest.fixture
    def service(self):
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = "test-key"
            svc = ApolloService()
        return svc

    def test_transform_full_person(self, service):
        """Test transforming a person with all fields populated."""
        person = mock_apollo_person()
        result = service._transform_person(person)

        assert result["name"] == "Jane Smith"
        assert result["first_name"] == "Jane"
        assert result["last_name"] == "Smith"
        assert result["email"] == "jane.smith@techcorp.com"
        assert result["title"] == "Senior Software Engineer"
        assert result["company"] == "TechCorp"
        assert result["location"] == "San Francisco, California, United States"
        assert result["profile_url"] == "https://linkedin.com/in/janesmith"
        assert result["platform"] == "apollo"
        assert "Python" in result["skills"]
        assert "FastAPI" in result["skills"]
        assert "distributed systems" in result["skills"]
        assert result["phone"] == "+1-555-987-6543"
        assert result["raw_data"]["apollo_id"] == "apollo-123"
        assert result["raw_data"]["email_status"] == "verified"
        assert result["raw_data"]["seniority"] == "senior"
        assert result["raw_data"]["photo_url"] == "https://example.com/photo.jpg"

    def test_transform_minimal_person(self, service):
        """Test transforming a person with minimal data."""
        person = {
            "name": "Bob Jones",
            "first_name": "",
            "last_name": "",
        }
        result = service._transform_person(person)

        assert result["name"] == "Bob Jones"
        assert result["first_name"] == "Bob"
        assert result["last_name"] == "Jones"
        assert result["email"] is None
        assert result["title"] == ""
        assert result["company"] == ""
        assert result["location"] == ""
        assert result["skills"] == []
        assert result["experience_years"] is None
        assert result["phone"] is None

    def test_transform_experience_years_calculation(self, service):
        """Test experience years calculated from employment history."""
        person = mock_apollo_person()
        result = service._transform_person(person)

        # Earliest start_date is 2017, current year is dynamic
        from datetime import datetime

        expected_years = datetime.now().year - 2017
        assert result["experience_years"] == expected_years

    def test_transform_skills_limited_to_20(self, service):
        """Test that skills are capped at 20."""
        person = mock_apollo_person()
        person["technologies"] = [f"tech-{i}" for i in range(15)]
        person["keywords"] = [f"keyword-{i}" for i in range(10)]

        result = service._transform_person(person)
        assert len(result["skills"]) == 20

    def test_transform_location_partial(self, service):
        """Test location with only city."""
        person = mock_apollo_person()
        person["state"] = ""
        person["country"] = ""

        result = service._transform_person(person)
        assert result["location"] == "San Francisco"

    def test_transform_no_phone_numbers(self, service):
        """Test person without phone numbers."""
        person = mock_apollo_person()
        person["phone_numbers"] = []

        result = service._transform_person(person)
        assert result["phone"] is None

    def test_transform_name_from_first_last(self, service):
        """Test name built from first_name + last_name when name is empty."""
        person = {
            "name": "",
            "first_name": "Alice",
            "last_name": "Wonder",
        }
        result = service._transform_person(person)
        assert result["name"] == "Alice Wonder"

    def test_transform_title_fallback_to_headline(self, service):
        """Test title falls back to headline."""
        person = mock_apollo_person()
        person["title"] = None
        person["employment_history"] = []

        result = service._transform_person(person)
        assert result["title"] == "Senior Software Engineer at TechCorp"

    def test_transform_company_from_organization(self, service):
        """Test company extracted from organization object."""
        person = mock_apollo_person()
        person["organization_name"] = None

        result = service._transform_person(person)
        assert result["company"] == "TechCorp"


class TestApolloRateLimiting:
    """Test rate limiting behavior."""

    @pytest.fixture
    def service(self):
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = "test-key"
            svc = ApolloService()
        return svc

    @pytest.mark.asyncio
    async def test_rate_limit_cleans_old_timestamps(self, service):
        """Test that old timestamps are removed."""
        # Add timestamps from 2 minutes ago (outside the 60s window)
        old_time = time.time() - 120
        service._request_timestamps = [old_time] * 10

        await service._rate_limit()

        # Old timestamps should be cleaned, only the new one remains
        assert len(service._request_timestamps) == 1

    @pytest.mark.asyncio
    async def test_rate_limit_adds_timestamp(self, service):
        """Test that rate limit tracking adds a timestamp."""
        assert len(service._request_timestamps) == 0

        await service._rate_limit()

        assert len(service._request_timestamps) == 1


class TestApolloMakeRequest:
    """Test the _make_request HTTP client method."""

    @pytest.fixture
    def service(self):
        with patch("app.services.apollo.settings") as mock_settings:
            mock_settings.apollo_api_key = "test-key"
            svc = ApolloService()
        return svc

    @pytest.mark.asyncio
    async def test_make_get_request(self, service):
        """Test making a GET request."""
        mock_request = httpx.Request("GET", "https://api.apollo.io/v1/test/endpoint")
        mock_response = httpx.Response(200, json={"data": "test"}, request=mock_request)

        with patch("httpx.AsyncClient") as MockClient:
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service._make_request("GET", "test/endpoint", params={"q": "test"})

        assert result == {"data": "test"}
        mock_client_instance.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_make_post_request(self, service):
        """Test making a POST request."""
        mock_request = httpx.Request("POST", "https://api.apollo.io/v1/mixed_people/search")
        mock_response = httpx.Response(200, json={"people": []}, request=mock_request)

        with patch("httpx.AsyncClient") as MockClient:
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service._make_request(
                "POST", "mixed_people/search", data={"person_titles": ["Engineer"]}
            )

        assert result == {"people": []}
        mock_client_instance.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_make_request_default_empty_data(self, service):
        """Test that data defaults to empty dict when None."""
        mock_request = httpx.Request("POST", "https://api.apollo.io/v1/endpoint")
        mock_response = httpx.Response(200, json={}, request=mock_request)

        with patch("httpx.AsyncClient") as MockClient:
            mock_client_instance = AsyncMock()
            mock_client_instance.post.return_value = mock_response
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            await service._make_request("POST", "endpoint")

        # Verify json={} was passed (not None)
        call_kwargs = mock_client_instance.post.call_args[1]
        assert call_kwargs["json"] == {}


class TestSourcingCascadeApollo:
    """Test Apollo integration within the sourcing cascade."""

    @pytest.mark.asyncio
    async def test_search_with_apollo_success(self):
        """Test _search_with_apollo helper function."""
        from app.agents.sourcing_assistant import _search_with_apollo

        mock_result = {
            "status": "success",
            "people": [mock_apollo_person()],
            "pagination": {"total": 1, "page": 1, "per_page": 25},
        }

        with patch("app.services.apollo.apollo") as mock_apollo:
            mock_apollo.api_key = "test-key"
            mock_apollo.search_people = AsyncMock(return_value=mock_result)

            result = await _search_with_apollo(
                job_titles=["Software Engineer"],
                skills=["Python"],
                locations=["San Francisco"],
                limit=10,
            )

        assert result["status"] == "success"
        assert len(result["people"]) == 1
        mock_apollo.search_people.assert_called_once_with(
            job_titles=["Software Engineer"],
            skills=["Python"],
            locations=["San Francisco"],
            per_page=10,
        )

    @pytest.mark.asyncio
    async def test_search_with_apollo_not_configured(self):
        """Test _search_with_apollo when API key is missing."""
        from app.agents.sourcing_assistant import _search_with_apollo

        with patch("app.services.apollo.apollo") as mock_apollo:
            mock_apollo.api_key = ""

            result = await _search_with_apollo(
                job_titles=["Engineer"], skills=["Python"], locations=None, limit=10
            )

        assert result["status"] == "not_configured"

    @pytest.mark.asyncio
    async def test_search_with_apollo_limit_capped_at_25(self):
        """Test that the limit passed to Apollo is capped at 25."""
        from app.agents.sourcing_assistant import _search_with_apollo

        mock_result = {"status": "success", "people": [], "pagination": {}}

        with patch("app.services.apollo.apollo") as mock_apollo:
            mock_apollo.api_key = "test-key"
            mock_apollo.search_people = AsyncMock(return_value=mock_result)

            await _search_with_apollo(
                job_titles=["Engineer"], skills=["Python"], locations=None, limit=100
            )

        # per_page should be min(100, 25) = 25
        mock_apollo.search_people.assert_called_once_with(
            job_titles=["Engineer"],
            skills=["Python"],
            locations=None,
            per_page=25,
        )
