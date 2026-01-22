"""Integration tests for Assessment API endpoints."""

from datetime import datetime, timedelta
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import (
    TEST_APPLICATION_ID,
    TEST_ASSESSMENT_ID,
    mock_assessment_data,
)


class TestAssessmentAPIGenerateQuestions:
    """Test cases for question generation endpoint."""

    def test_generate_questions_success(
        self, client, mock_supabase_service, mock_agent_coordinator
    ):
        """Test successful question generation."""
        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                f"/api/v1/assess/generate-questions?application_id={TEST_APPLICATION_ID}"
            )

            assert response.status_code == 200
            data = response.json()
            assert "assessment_id" in data
            assert "access_token" in data
            assert "questions" in data
            assert "candidate_assessment_url" in data

    def test_generate_questions_application_not_found(
        self, client, mock_supabase_service, mock_agent_coordinator
    ):
        """Test question generation with non-existent application."""
        mock_supabase_service.get_application = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                "/api/v1/assess/generate-questions?application_id=non-existent"
            )

            assert response.status_code == 404
            assert response.json()["detail"] == "Application not found"

    def test_generate_questions_job_not_found(
        self, client, mock_supabase_service, mock_agent_coordinator
    ):
        """Test question generation when job is not found."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                f"/api/v1/assess/generate-questions?application_id={TEST_APPLICATION_ID}"
            )

            assert response.status_code == 404
            assert response.json()["detail"] == "Job not found"

    def test_generate_questions_candidate_not_found(
        self, client, mock_supabase_service, mock_agent_coordinator
    ):
        """Test question generation when candidate is not found."""
        mock_supabase_service.get_candidate = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.agent_coordinator", mock_agent_coordinator
        ):
            response = client.post(
                f"/api/v1/assess/generate-questions?application_id={TEST_APPLICATION_ID}"
            )

            assert response.status_code == 404
            assert response.json()["detail"] == "Candidate not found"


class TestAssessmentAPISchedule:
    """Test cases for assessment scheduling endpoint."""

    def test_schedule_assessment_success(self, client, mock_supabase_service):
        """Test successful assessment scheduling."""
        # Set up mock to return None for existing assessment
        execute_result = MagicMock()
        execute_result.data = []
        mock_supabase_service.client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.generate_questions",
            new=AsyncMock(
                return_value={"assessment_id": TEST_ASSESSMENT_ID, "questions": []}
            ),
        ):
            scheduled_time = (datetime.utcnow() + timedelta(days=3)).isoformat()
            response = client.post(
                "/api/v1/assess/schedule",
                json={
                    "application_id": TEST_APPLICATION_ID,
                    "candidate_email": "test@example.com",
                    "preferred_times": [scheduled_time],
                    "duration_minutes": 45,
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "scheduled"
            assert "assessment_id" in data
            assert data["duration_minutes"] == 45

    def test_schedule_assessment_application_not_found(self, client, mock_supabase_service):
        """Test scheduling with non-existent application."""
        mock_supabase_service.get_application = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.post(
                "/api/v1/assess/schedule",
                json={
                    "application_id": "non-existent",
                    "candidate_email": "test@example.com",
                    "preferred_times": [],
                    "duration_minutes": 30,
                },
            )

            assert response.status_code == 404

    def test_schedule_existing_assessment(self, client, mock_supabase_service):
        """Test scheduling when assessment already exists."""
        existing_assessment = mock_assessment_data()
        execute_result = MagicMock()
        execute_result.data = [existing_assessment]
        mock_supabase_service.client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.post(
                "/api/v1/assess/schedule",
                json={
                    "application_id": TEST_APPLICATION_ID,
                    "candidate_email": "test@example.com",
                    "preferred_times": [],
                    "duration_minutes": 30,
                },
            )

            assert response.status_code == 200


class TestAssessmentAPIToken:
    """Test cases for assessment token endpoint."""

    def test_get_assessment_by_token_success(self, client, mock_supabase_service):
        """Test getting assessment by valid token."""
        # Set future expiry
        assessment = mock_assessment_data()
        assessment["token_expires_at"] = (datetime.utcnow() + timedelta(days=7)).isoformat()
        mock_supabase_service.get_assessment_by_token = AsyncMock(return_value=assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get("/api/v1/assess/token/test-access-token-12345")

            assert response.status_code == 200
            data = response.json()
            assert "assessment_id" in data
            assert "questions" in data
            assert "job_title" in data

    def test_get_assessment_token_not_found(self, client, mock_supabase_service):
        """Test getting assessment with invalid token."""
        mock_supabase_service.get_assessment_by_token = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get("/api/v1/assess/token/invalid-token")

            assert response.status_code == 404
            assert "not found or expired" in response.json()["detail"]

    def test_get_assessment_token_expired(self, client, mock_supabase_service):
        """Test getting assessment with expired token."""
        assessment = mock_assessment_data()
        assessment["token_expires_at"] = (datetime.utcnow() - timedelta(days=1)).isoformat()
        mock_supabase_service.get_assessment_by_token = AsyncMock(return_value=assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get("/api/v1/assess/token/expired-token")

            assert response.status_code == 401
            assert "expired" in response.json()["detail"]


class TestAssessmentAPISubmitVideo:
    """Test cases for video submission endpoint."""

    def test_submit_video_success(self, client, mock_supabase_service, mock_storage):
        """Test successful video submission."""
        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.storage", mock_storage
        ), patch(
            "app.api.v1.assessment.analyze_video_async", new=AsyncMock()
        ):
            files = {"file": ("video.webm", BytesIO(b"video content"), "video/webm")}
            data = {"assessment_id": TEST_ASSESSMENT_ID}

            response = client.post("/api/v1/assess/submit-video", files=files, data=data)

            assert response.status_code == 200
            result = response.json()
            assert result["status"] == "video_uploaded"
            assert result["assessment_id"] == TEST_ASSESSMENT_ID

    def test_submit_video_invalid_file_type(self, client, mock_supabase_service):
        """Test submitting non-video file."""
        with patch("app.api.v1.assessment.db", mock_supabase_service):
            files = {"file": ("document.pdf", BytesIO(b"pdf content"), "application/pdf")}
            data = {"assessment_id": TEST_ASSESSMENT_ID}

            response = client.post("/api/v1/assess/submit-video", files=files, data=data)

            assert response.status_code == 400
            assert "Only video files" in response.json()["detail"]

    def test_submit_video_assessment_not_found(self, client, mock_supabase_service, mock_storage):
        """Test submitting video for non-existent assessment."""
        mock_supabase_service.get_assessment = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service), patch(
            "app.api.v1.assessment.storage", mock_storage
        ):
            files = {"file": ("video.webm", BytesIO(b"video content"), "video/webm")}
            data = {"assessment_id": "non-existent"}

            response = client.post("/api/v1/assess/submit-video", files=files, data=data)

            assert response.status_code == 404

    def test_submit_video_no_file(self, client, mock_supabase_service):
        """Test submitting without a file."""
        with patch("app.api.v1.assessment.db", mock_supabase_service):
            data = {"assessment_id": TEST_ASSESSMENT_ID}

            response = client.post("/api/v1/assess/submit-video", data=data)

            assert response.status_code == 422


class TestAssessmentAPIDetails:
    """Test cases for assessment details endpoint."""

    def test_get_assessment_success(self, client, mock_supabase_service):
        """Test getting assessment details."""
        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get(f"/api/v1/assess/{TEST_ASSESSMENT_ID}")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == TEST_ASSESSMENT_ID
            assert "candidate" in data

    def test_get_assessment_not_found(self, client, mock_supabase_service):
        """Test getting non-existent assessment."""
        mock_supabase_service.get_assessment = AsyncMock(return_value=None)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get("/api/v1/assess/non-existent")

            assert response.status_code == 404


class TestAssessmentAPIAnalysis:
    """Test cases for analysis endpoint."""

    def test_get_analysis_success(self, client, mock_supabase_service):
        """Test getting assessment analysis."""
        analyzed_assessment = mock_assessment_data()
        analyzed_assessment["status"] = "analyzed"
        analyzed_assessment["overall_score"] = 82
        analyzed_assessment["recommendation"] = "YES"
        analyzed_assessment["confidence_level"] = "high"
        analyzed_assessment["response_scores"] = []
        analyzed_assessment["video_analysis"] = {
            "communication_assessment": {"clarity": 85},
            "behavioral_assessment": {"confidence": 78},
        }
        analyzed_assessment["summary"] = {"top_strengths": ["Clear communication"]}
        mock_supabase_service.get_assessment = AsyncMock(return_value=analyzed_assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get(f"/api/v1/assess/{TEST_ASSESSMENT_ID}/analysis")

            assert response.status_code == 200
            data = response.json()
            assert data["overall_score"] == 82
            assert data["recommendation"] == "YES"

    def test_get_analysis_not_completed(self, client, mock_supabase_service):
        """Test getting analysis for incomplete assessment."""
        pending_assessment = mock_assessment_data()
        pending_assessment["status"] = "pending"
        mock_supabase_service.get_assessment = AsyncMock(return_value=pending_assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get(f"/api/v1/assess/{TEST_ASSESSMENT_ID}/analysis")

            assert response.status_code == 400
            assert "not yet completed" in response.json()["detail"]


class TestAssessmentAPIApproval:
    """Test cases for assessment approval endpoints."""

    def test_approve_for_offer_success(self, client, mock_supabase_service):
        """Test approving candidate for offer."""
        completed_assessment = mock_assessment_data()
        completed_assessment["status"] = "completed"
        mock_supabase_service.get_assessment = AsyncMock(return_value=completed_assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.post(f"/api/v1/assess/{TEST_ASSESSMENT_ID}/approve")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "approved_for_offer"
            assert data["assessment_id"] == TEST_ASSESSMENT_ID

    def test_approve_not_completed(self, client, mock_supabase_service):
        """Test approving incomplete assessment."""
        pending_assessment = mock_assessment_data()
        pending_assessment["status"] = "pending"
        mock_supabase_service.get_assessment = AsyncMock(return_value=pending_assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.post(f"/api/v1/assess/{TEST_ASSESSMENT_ID}/approve")

            assert response.status_code == 400

    def test_reject_candidate_success(self, client, mock_supabase_service):
        """Test rejecting candidate after assessment."""
        completed_assessment = mock_assessment_data()
        completed_assessment["status"] = "completed"
        mock_supabase_service.get_assessment = AsyncMock(return_value=completed_assessment)

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.post(
                f"/api/v1/assess/{TEST_ASSESSMENT_ID}/reject",
                params={"reason": "Not a culture fit"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "rejected"


class TestAssessmentAPIApplicationAssessments:
    """Test cases for getting assessments by application."""

    def test_get_assessments_for_application(self, client, mock_supabase_service):
        """Test getting all assessments for an application."""
        assessments = [mock_assessment_data()]
        execute_result = MagicMock()
        execute_result.data = assessments
        mock_supabase_service.client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = (
            execute_result
        )

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get(
                f"/api/v1/assess/application/{TEST_APPLICATION_ID}/assessments"
            )

            assert response.status_code == 200
            data = response.json()
            assert data["application_id"] == TEST_APPLICATION_ID
            assert len(data["assessments"]) == 1

    def test_get_assessments_none_exist(self, client, mock_supabase_service):
        """Test getting assessments when none exist."""
        execute_result = MagicMock()
        execute_result.data = []
        mock_supabase_service.client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = (
            execute_result
        )

        with patch("app.api.v1.assessment.db", mock_supabase_service):
            response = client.get(
                f"/api/v1/assess/application/{TEST_APPLICATION_ID}/assessments"
            )

            assert response.status_code == 200
            data = response.json()
            assert data["assessments"] == []
