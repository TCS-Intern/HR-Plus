"""Integration tests for JD API endpoints."""

from unittest.mock import AsyncMock, patch

from tests.conftest import (
    TEST_JOB_ID,
    mock_job_data,
)


class TestJDAPICreate:
    """Test cases for JD creation endpoints."""

    def test_create_jd_success(self, client, mock_supabase_service, mock_agent_coordinator):
        """Test successful JD creation."""
        with patch("app.api.v1.jd.db", mock_supabase_service), patch(
            "app.api.v1.jd.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                "/api/v1/jd/create",
                json={
                    "input_type": "text",
                    "input_text": "We need a Senior Python Developer for our backend team.",
                    "department": "Engineering",
                    "hiring_manager": "Jane Smith",
                    "urgency": "normal",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "id" in data
            assert "title" in data
            assert data["status"] == "draft"

    def test_create_jd_with_voice_input(self, client, mock_supabase_service, mock_agent_coordinator):
        """Test JD creation with voice transcript."""
        with patch("app.api.v1.jd.db", mock_supabase_service), patch(
            "app.api.v1.jd.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                "/api/v1/jd/create",
                json={
                    "input_type": "voice",
                    "voice_transcript": "I need someone who can lead the team and write Python code",
                    "department": "Engineering",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "title" in data

    def test_create_jd_minimal_input(self, client, mock_supabase_service, mock_agent_coordinator):
        """Test JD creation with minimal input."""
        with patch("app.api.v1.jd.db", mock_supabase_service), patch(
            "app.api.v1.jd.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                "/api/v1/jd/create",
                json={
                    "input_type": "text",
                    "input_text": "Software engineer needed",
                },
            )

            assert response.status_code == 200


class TestJDAPIRead:
    """Test cases for JD read endpoints."""

    def test_list_jobs(self, client, mock_supabase_service):
        """Test listing all jobs."""
        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.get("/api/v1/jd")

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)

    def test_list_jobs_with_status_filter(self, client, mock_supabase_service):
        """Test listing jobs with status filter."""
        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.get("/api/v1/jd?status=active")

            assert response.status_code == 200
            mock_supabase_service.list_jobs.assert_called_with(status="active", limit=50)

    def test_list_jobs_with_limit(self, client, mock_supabase_service):
        """Test listing jobs with custom limit."""
        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.get("/api/v1/jd?limit=10")

            assert response.status_code == 200
            mock_supabase_service.list_jobs.assert_called_with(status=None, limit=10)

    def test_get_jd_success(self, client, mock_supabase_service):
        """Test getting a specific job."""
        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.get(f"/api/v1/jd/{TEST_JOB_ID}")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == TEST_JOB_ID

    def test_get_jd_not_found(self, client, mock_supabase_service):
        """Test getting a non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.get("/api/v1/jd/00000000-0000-0000-0000-000000000000")

            assert response.status_code == 404
            assert response.json()["detail"] == "Job not found"


class TestJDAPIUpdate:
    """Test cases for JD update endpoints."""

    def test_update_jd_success(self, client, mock_supabase_service):
        """Test successful JD update."""
        updated_job = mock_job_data()
        updated_job["title"] = "Staff Software Engineer"
        mock_supabase_service.update_job = AsyncMock(return_value=updated_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.put(
                f"/api/v1/jd/{TEST_JOB_ID}",
                json={
                    "title": "Staff Software Engineer",
                    "department": "Platform Engineering",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "Staff Software Engineer"

    def test_update_jd_salary_range(self, client, mock_supabase_service):
        """Test updating JD salary range."""
        updated_job = mock_job_data()
        updated_job["salary_range"] = {"min": 180000, "max": 220000, "currency": "USD"}
        mock_supabase_service.update_job = AsyncMock(return_value=updated_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.put(
                f"/api/v1/jd/{TEST_JOB_ID}",
                json={
                    "salary_range": {"min": 180000, "max": 220000, "currency": "USD"},
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["salary_range"]["min"] == 180000

    def test_update_jd_not_found(self, client, mock_supabase_service):
        """Test updating a non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.put(
                "/api/v1/jd/00000000-0000-0000-0000-000000000000",
                json={"title": "New Title"},
            )

            assert response.status_code == 404

    def test_update_jd_skills_matrix(self, client, mock_supabase_service):
        """Test updating JD skills matrix."""
        updated_job = mock_job_data()
        updated_job["skills_matrix"]["required"].append(
            {"skill": "Kubernetes", "proficiency": "intermediate", "weight": 0.6}
        )
        mock_supabase_service.update_job = AsyncMock(return_value=updated_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.put(
                f"/api/v1/jd/{TEST_JOB_ID}",
                json={
                    "skills_matrix": {
                        "required": [
                            {"skill": "Python", "proficiency": "advanced", "weight": 0.9},
                            {"skill": "Kubernetes", "proficiency": "intermediate", "weight": 0.6},
                        ],
                        "nice_to_have": [],
                    }
                },
            )

            assert response.status_code == 200


class TestJDAPIApproval:
    """Test cases for JD approval endpoints."""

    def test_approve_jd_success(self, client, mock_supabase_service):
        """Test successful JD approval."""
        draft_job = mock_job_data()
        draft_job["status"] = "draft"
        mock_supabase_service.get_job = AsyncMock(return_value=draft_job)

        approved_job = mock_job_data()
        approved_job["status"] = "active"
        mock_supabase_service.update_job = AsyncMock(return_value=approved_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.post(f"/api/v1/jd/{TEST_JOB_ID}/approve")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "active"

    def test_approve_jd_already_active(self, client, mock_supabase_service):
        """Test approving an already active job."""
        active_job = mock_job_data()
        active_job["status"] = "active"
        mock_supabase_service.get_job = AsyncMock(return_value=active_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.post(f"/api/v1/jd/{TEST_JOB_ID}/approve")

            assert response.status_code == 400
            assert "already active" in response.json()["detail"]

    def test_approve_jd_not_found(self, client, mock_supabase_service):
        """Test approving a non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.post("/api/v1/jd/00000000-0000-0000-0000-000000000000/approve")

            assert response.status_code == 404


class TestJDAPIClose:
    """Test cases for JD close endpoints."""

    def test_close_jd_success(self, client, mock_supabase_service):
        """Test closing a job."""
        active_job = mock_job_data()
        active_job["status"] = "active"
        mock_supabase_service.get_job = AsyncMock(return_value=active_job)

        closed_job = mock_job_data()
        closed_job["status"] = "closed"
        mock_supabase_service.update_job = AsyncMock(return_value=closed_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.post(f"/api/v1/jd/{TEST_JOB_ID}/close")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "closed"

    def test_close_jd_as_filled(self, client, mock_supabase_service):
        """Test closing a job as filled."""
        active_job = mock_job_data()
        active_job["status"] = "active"
        mock_supabase_service.get_job = AsyncMock(return_value=active_job)

        filled_job = mock_job_data()
        filled_job["status"] = "filled"
        mock_supabase_service.update_job = AsyncMock(return_value=filled_job)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.post(f"/api/v1/jd/{TEST_JOB_ID}/close?filled=true")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "filled"

    def test_close_jd_not_found(self, client, mock_supabase_service):
        """Test closing a non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.post("/api/v1/jd/00000000-0000-0000-0000-000000000000/close")

            assert response.status_code == 404


class TestJDAPIValidation:
    """Test cases for JD API validation."""

    def test_create_jd_invalid_job_type(self, client, mock_supabase_service, mock_agent_coordinator):
        """Test creating JD with invalid data is handled gracefully."""
        # The agent should handle and normalize invalid inputs
        with patch("app.api.v1.jd.db", mock_supabase_service), patch(
            "app.api.v1.jd.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                "/api/v1/jd/create",
                json={
                    "input_type": "text",
                    "input_text": "Need someone",
                },
            )

            # Should succeed even with minimal input
            assert response.status_code == 200

    def test_update_jd_invalid_uuid(self, client, mock_supabase_service):
        """Test updating with invalid UUID format."""
        with patch("app.api.v1.jd.db", mock_supabase_service):
            response = client.put(
                "/api/v1/jd/not-a-valid-uuid",
                json={"title": "New Title"},
            )

            # FastAPI should return 422 for invalid UUID
            assert response.status_code == 422
