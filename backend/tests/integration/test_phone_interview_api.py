"""Integration tests for Phone Interview API endpoints."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from tests.conftest import (
    TEST_APPLICATION_ID,
    mock_application_data,
    mock_candidate_data,
    mock_job_data,
)

TEST_PHONE_SCREEN_ID = str(uuid.uuid4())
TEST_ACCESS_TOKEN = "test-interview-access-token-12345"


def mock_phone_screen_data() -> dict:
    """Generate mock phone screen data for web interviews."""
    return {
        "id": TEST_PHONE_SCREEN_ID,
        "application_id": TEST_APPLICATION_ID,
        "interview_mode": "web",
        "access_token": TEST_ACCESS_TOKEN,
        "token_expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "status": "scheduled",
        "transcript": [],
        "conversation_state": {},
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


class TestPhoneInterviewScheduleWeb:
    """Test cases for scheduling web interviews."""

    def test_schedule_web_interview_success(self, client, mock_supabase_service):
        """Test successful web interview scheduling."""
        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_phone_screen_by_application = AsyncMock(return_value=None)
        mock_supabase_service.create_phone_screen = AsyncMock(return_value=mock_phone_screen_data())
        mock_supabase_service.update_application = AsyncMock(return_value=mock_application_data())

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.post(
                "/api/v1/phone-interview/schedule-web",
                json={"application_id": TEST_APPLICATION_ID, "is_simulation": False},
            )

            assert response.status_code == 200
            data = response.json()
            assert "phone_screen_id" in data
            assert "access_token" in data
            assert "interview_url" in data
            assert data["interview_mode"] == "web"

    def test_schedule_simulation_interview(self, client, mock_supabase_service):
        """Test scheduling a simulation interview."""
        simulation_screen = mock_phone_screen_data()
        simulation_screen["interview_mode"] = "simulation"

        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_phone_screen_by_application = AsyncMock(return_value=None)
        mock_supabase_service.create_phone_screen = AsyncMock(return_value=simulation_screen)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.post(
                "/api/v1/phone-interview/schedule-web",
                json={"application_id": TEST_APPLICATION_ID, "is_simulation": True},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["interview_mode"] == "simulation"

    def test_schedule_interview_application_not_found(self, client, mock_supabase_service):
        """Test scheduling interview when application doesn't exist."""
        mock_supabase_service.get_application = AsyncMock(return_value=None)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.post(
                "/api/v1/phone-interview/schedule-web",
                json={"application_id": "non-existent", "is_simulation": False},
            )

            assert response.status_code == 404
            assert "Application not found" in response.json()["detail"]

    def test_schedule_interview_existing_active(self, client, mock_supabase_service):
        """Test scheduling when an active interview already exists."""
        existing_screen = mock_phone_screen_data()
        existing_screen["status"] = "in_progress"
        existing_screen["interview_mode"] = "phone"  # Not web, so should fail

        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_phone_screen_by_application = AsyncMock(
            return_value=existing_screen
        )

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.post(
                "/api/v1/phone-interview/schedule-web",
                json={"application_id": TEST_APPLICATION_ID, "is_simulation": False},
            )

            assert response.status_code == 400
            assert "already exists" in response.json()["detail"]

    def test_schedule_interview_returns_existing_web(self, client, mock_supabase_service):
        """Test that scheduling returns existing web interview if one exists."""
        existing_screen = mock_phone_screen_data()
        existing_screen["status"] = "scheduled"
        existing_screen["interview_mode"] = "web"

        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_phone_screen_by_application = AsyncMock(
            return_value=existing_screen
        )

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.post(
                "/api/v1/phone-interview/schedule-web",
                json={"application_id": TEST_APPLICATION_ID, "is_simulation": False},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["phone_screen_id"] == existing_screen["id"]


class TestPhoneInterviewPublicEndpoints:
    """Test cases for public interview endpoints (candidate-facing)."""

    def test_get_interview_by_token_success(self, client, mock_supabase_service):
        """Test getting interview info by valid token."""
        phone_screen = mock_phone_screen_data()
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=phone_screen)
        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_candidate = AsyncMock(return_value=mock_candidate_data())
        mock_supabase_service.get_job = AsyncMock(return_value=mock_job_data())

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get(f"/api/v1/phone-interview/token/{TEST_ACCESS_TOKEN}")

            assert response.status_code == 200
            data = response.json()
            assert "interview_id" in data
            assert "candidate_name" in data
            assert "job_title" in data
            assert "company_name" in data
            assert data["status"] == "scheduled"
            assert data["is_simulation"] is False

    def test_get_interview_token_not_found(self, client, mock_supabase_service):
        """Test getting interview with invalid token."""
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=None)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get("/api/v1/phone-interview/token/invalid-token")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"]

    def test_get_interview_token_expired(self, client, mock_supabase_service):
        """Test getting interview with expired token."""
        expired_screen = mock_phone_screen_data()
        expired_screen["token_expires_at"] = (datetime.utcnow() - timedelta(days=1)).isoformat()
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=expired_screen)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get(f"/api/v1/phone-interview/token/{TEST_ACCESS_TOKEN}")

            assert response.status_code == 401
            assert "expired" in response.json()["detail"]

    def test_get_transcript_success(self, client, mock_supabase_service):
        """Test getting interview transcript."""
        phone_screen = mock_phone_screen_data()
        phone_screen["transcript"] = [
            {"role": "assistant", "content": "Hello!", "timestamp": "2024-01-15T10:00:00Z"},
            {"role": "user", "content": "Hi there", "timestamp": "2024-01-15T10:00:30Z"},
        ]
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=phone_screen)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get(f"/api/v1/phone-interview/token/{TEST_ACCESS_TOKEN}/transcript")

            assert response.status_code == 200
            data = response.json()
            assert "transcript" in data
            assert len(data["transcript"]) == 2
            assert data["status"] == "scheduled"

    def test_complete_interview_success(
        self, client, mock_supabase_service, mock_agent_coordinator
    ):
        """Test completing an interview."""
        phone_screen = mock_phone_screen_data()
        phone_screen["status"] = "in_progress"
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=phone_screen)
        mock_supabase_service.update_phone_screen = AsyncMock(return_value=phone_screen)

        # Mock background task - analysis runs in background
        with (
            patch("app.api.v1.phone_interview.db", mock_supabase_service),
            patch("app.api.v1.phone_interview._analyze_phone_interview", new=AsyncMock()),
        ):
            response = client.post(f"/api/v1/phone-interview/token/{TEST_ACCESS_TOKEN}/complete")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert "interview_id" in data

    def test_complete_interview_not_found(self, client, mock_supabase_service):
        """Test completing a non-existent interview."""
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=None)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.post("/api/v1/phone-interview/token/invalid-token/complete")

            assert response.status_code == 404


class TestPhoneInterviewAuthenticatedEndpoints:
    """Test cases for authenticated endpoints (recruiter-facing)."""

    def test_get_phone_interview_details(self, client, mock_supabase_service):
        """Test getting phone interview details by ID."""
        phone_screen = mock_phone_screen_data()
        mock_supabase_service.get_phone_screen = AsyncMock(return_value=phone_screen)
        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_candidate = AsyncMock(return_value=mock_candidate_data())
        mock_supabase_service.get_job = AsyncMock(return_value=mock_job_data())

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get(f"/api/v1/phone-interview/{TEST_PHONE_SCREEN_ID}")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == TEST_PHONE_SCREEN_ID
            assert "candidate" in data
            assert "job" in data

    def test_get_phone_interview_not_found(self, client, mock_supabase_service):
        """Test getting non-existent phone interview."""
        mock_supabase_service.get_phone_screen = AsyncMock(return_value=None)

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get("/api/v1/phone-interview/non-existent-id")

            assert response.status_code == 404


class TestPhoneInterviewSimulation:
    """Test cases for simulation mode."""

    def test_simulation_flag_in_response(self, client, mock_supabase_service):
        """Test that simulation interviews are properly flagged."""
        simulation_screen = mock_phone_screen_data()
        simulation_screen["interview_mode"] = "simulation"
        mock_supabase_service.get_phone_screen_by_token = AsyncMock(return_value=simulation_screen)
        mock_supabase_service.get_application = AsyncMock(return_value=mock_application_data())
        mock_supabase_service.get_candidate = AsyncMock(return_value=mock_candidate_data())
        mock_supabase_service.get_job = AsyncMock(return_value=mock_job_data())

        with patch("app.api.v1.phone_interview.db", mock_supabase_service):
            response = client.get(f"/api/v1/phone-interview/token/{TEST_ACCESS_TOKEN}")

            assert response.status_code == 200
            data = response.json()
            assert data["is_simulation"] is True
