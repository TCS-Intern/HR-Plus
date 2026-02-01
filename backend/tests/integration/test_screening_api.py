"""Integration tests for Screening API endpoints."""

from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import (
    TEST_APPLICATION_ID,
    TEST_JOB_ID,
    mock_application_data,
    mock_candidate_data,
)


class TestScreeningAPIStart:
    """Test cases for screening start endpoint."""

    def test_start_screening_success(self, client, mock_supabase_service):
        """Test starting screening for a job."""
        applications = [
            {**mock_application_data(), "status": "new"},
            {**mock_application_data(), "id": "app-2", "status": "new"},
        ]
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=applications)

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.post(f"/api/v1/screen/start?job_id={TEST_JOB_ID}")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "screening_started"
            assert data["job_id"] == TEST_JOB_ID
            assert data["total_applications"] == 2
            assert data["to_screen"] == 2

    def test_start_screening_job_not_found(self, client, mock_supabase_service):
        """Test starting screening for non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.post("/api/v1/screen/start?job_id=non-existent-id")

            assert response.status_code == 404
            assert response.json()["detail"] == "Job not found"

    def test_start_screening_no_applications(self, client, mock_supabase_service):
        """Test starting screening with no applications."""
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=[])

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.post(f"/api/v1/screen/start?job_id={TEST_JOB_ID}")

            assert response.status_code == 200
            data = response.json()
            assert data["total_applications"] == 0
            assert data["to_screen"] == 0


class TestScreeningAPIUploadCV:
    """Test cases for CV upload endpoint."""

    def test_upload_cv_pdf_success(
        self,
        client,
        mock_supabase_service,
        mock_agent_coordinator,
        mock_storage,
        mock_document_parser,
    ):
        """Test uploading a PDF resume."""
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=[])

        with (
            patch("app.api.v1.screening.db", mock_supabase_service),
            patch("app.api.v1.screening.agent_coordinator", mock_agent_coordinator),
            patch("app.api.v1.screening.storage", mock_storage),
            patch("app.api.v1.screening.resume_parser", mock_document_parser),
        ):
            files = {"file": ("resume.pdf", BytesIO(b"PDF content"), "application/pdf")}
            data = {"job_id": TEST_JOB_ID}

            response = client.post("/api/v1/screen/upload-cv", files=files, data=data)

            assert response.status_code == 200
            result = response.json()
            assert "candidate" in result
            assert "application_id" in result
            assert result["status"] == "uploaded_and_screening"

    def test_upload_cv_docx_success(
        self,
        client,
        mock_supabase_service,
        mock_agent_coordinator,
        mock_storage,
        mock_document_parser,
    ):
        """Test uploading a DOCX resume."""
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=[])

        with (
            patch("app.api.v1.screening.db", mock_supabase_service),
            patch("app.api.v1.screening.agent_coordinator", mock_agent_coordinator),
            patch("app.api.v1.screening.storage", mock_storage),
            patch("app.api.v1.screening.resume_parser", mock_document_parser),
        ):
            files = {
                "file": (
                    "resume.docx",
                    BytesIO(b"DOCX content"),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            }
            data = {"job_id": TEST_JOB_ID}

            response = client.post("/api/v1/screen/upload-cv", files=files, data=data)

            assert response.status_code == 200

    def test_upload_cv_invalid_file_type(self, client, mock_supabase_service):
        """Test uploading an invalid file type."""
        with patch("app.api.v1.screening.db", mock_supabase_service):
            files = {"file": ("resume.txt", BytesIO(b"text content"), "text/plain")}
            data = {"job_id": TEST_JOB_ID}

            response = client.post("/api/v1/screen/upload-cv", files=files, data=data)

            assert response.status_code == 400
            assert "Only PDF and DOCX" in response.json()["detail"]

    def test_upload_cv_job_not_found(self, client, mock_supabase_service):
        """Test uploading CV for non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.screening.db", mock_supabase_service):
            files = {"file": ("resume.pdf", BytesIO(b"PDF content"), "application/pdf")}
            data = {"job_id": "non-existent-job"}

            response = client.post("/api/v1/screen/upload-cv", files=files, data=data)

            assert response.status_code == 404

    def test_upload_cv_no_file(self, client, mock_supabase_service):
        """Test uploading without a file."""
        with patch("app.api.v1.screening.db", mock_supabase_service):
            data = {"job_id": TEST_JOB_ID}

            response = client.post("/api/v1/screen/upload-cv", data=data)

            assert response.status_code == 422  # Validation error

    def test_upload_cv_existing_candidate(
        self,
        client,
        mock_supabase_service,
        mock_agent_coordinator,
        mock_storage,
        mock_document_parser,
    ):
        """Test uploading CV for existing candidate."""
        existing_app = mock_application_data()
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=[existing_app])

        with (
            patch("app.api.v1.screening.db", mock_supabase_service),
            patch("app.api.v1.screening.agent_coordinator", mock_agent_coordinator),
            patch("app.api.v1.screening.storage", mock_storage),
            patch("app.api.v1.screening.resume_parser", mock_document_parser),
        ):
            files = {"file": ("resume.pdf", BytesIO(b"PDF content"), "application/pdf")}
            data = {"job_id": TEST_JOB_ID}

            response = client.post("/api/v1/screen/upload-cv", files=files, data=data)

            # Should succeed and return existing application
            assert response.status_code == 200


class TestScreeningAPICandidates:
    """Test cases for screened candidates endpoint."""

    def test_get_screened_candidates_success(self, client, mock_supabase_service):
        """Test getting screened candidates."""
        applications = [
            {
                **mock_application_data(),
                "candidates": mock_candidate_data(),
                "screening_score": 85,
                "screening_recommendation": "strong_match",
            }
        ]
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=applications)

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.get(f"/api/v1/screen/{TEST_JOB_ID}/candidates")

            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == TEST_JOB_ID
            assert data["total_candidates"] == 1
            assert len(data["candidates"]) == 1
            assert data["candidates"][0]["screening_score"] == 85

    def test_get_screened_candidates_job_not_found(self, client, mock_supabase_service):
        """Test getting candidates for non-existent job."""
        mock_supabase_service.get_job = AsyncMock(return_value=None)

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.get("/api/v1/screen/non-existent-job/candidates")

            assert response.status_code == 404

    def test_get_screened_candidates_empty(self, client, mock_supabase_service):
        """Test getting candidates when none exist."""
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=[])

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.get(f"/api/v1/screen/{TEST_JOB_ID}/candidates")

            assert response.status_code == 200
            data = response.json()
            assert data["total_candidates"] == 0
            assert data["candidates"] == []


class TestScreeningAPIShortlist:
    """Test cases for shortlist endpoint."""

    def test_update_shortlist_success(self, client, mock_supabase_service):
        """Test shortlisting candidates."""
        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.put(
                "/api/v1/screen/shortlist",
                json=["app-1", "app-2", "app-3"],
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "shortlist_updated"
            assert data["updated_count"] == 3
            assert len(data["application_ids"]) == 3

    def test_update_shortlist_empty(self, client, mock_supabase_service):
        """Test shortlisting with empty list."""
        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.put("/api/v1/screen/shortlist", json=[])

            assert response.status_code == 200
            data = response.json()
            assert data["updated_count"] == 0

    def test_update_shortlist_partial_success(self, client, mock_supabase_service):
        """Test shortlisting with some failures."""
        # Make some updates fail
        call_count = [0]

        async def update_application_mock(app_id, data):
            call_count[0] += 1
            if call_count[0] == 2:
                raise Exception("Database error")
            return {"id": app_id, **data}

        mock_supabase_service.update_application = update_application_mock

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.put(
                "/api/v1/screen/shortlist",
                json=["app-1", "app-2", "app-3"],
            )

            assert response.status_code == 200
            data = response.json()
            assert data["updated_count"] == 2  # One failed


class TestScreeningAPIReject:
    """Test cases for reject endpoint."""

    def test_reject_candidate_success(self, client, mock_supabase_service):
        """Test rejecting a candidate."""
        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.post(
                f"/api/v1/screen/{TEST_APPLICATION_ID}/reject",
                params={"reason": "Not enough experience"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "rejected"
            assert data["application_id"] == TEST_APPLICATION_ID

    def test_reject_candidate_no_reason(self, client, mock_supabase_service):
        """Test rejecting without reason."""
        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.post(f"/api/v1/screen/{TEST_APPLICATION_ID}/reject")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "rejected"

    def test_reject_candidate_error(self, client, mock_supabase_service):
        """Test rejection when database error occurs."""
        mock_supabase_service.update_application = AsyncMock(side_effect=Exception("DB error"))

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.post(f"/api/v1/screen/{TEST_APPLICATION_ID}/reject")

            assert response.status_code == 500


class TestScreeningAPIEdgeCases:
    """Test edge cases for screening API."""

    def test_upload_cv_parse_error(
        self, client, mock_supabase_service, mock_storage, mock_document_parser
    ):
        """Test handling of document parse errors."""
        mock_document_parser.parse = MagicMock(
            side_effect=ValueError("Could not parse document")
        )

        with (
            patch("app.api.v1.screening.db", mock_supabase_service),
            patch("app.api.v1.screening.storage", mock_storage),
            patch("app.api.v1.screening.resume_parser", mock_document_parser),
        ):
            files = {"file": ("resume.pdf", BytesIO(b"corrupted"), "application/pdf")}
            data = {"job_id": TEST_JOB_ID}

            response = client.post("/api/v1/screen/upload-cv", files=files, data=data)

            assert response.status_code == 400
            assert "Could not parse" in response.json()["detail"]

    def test_get_candidates_includes_all_fields(self, client, mock_supabase_service):
        """Test that candidate response includes all expected fields."""
        application = mock_application_data()
        application["candidates"] = mock_candidate_data()
        application["strengths"] = ["Python", "FastAPI"]
        application["gaps"] = ["Kubernetes"]
        application["red_flags"] = []
        mock_supabase_service.list_applications_for_job = AsyncMock(return_value=[application])

        with patch("app.api.v1.screening.db", mock_supabase_service):
            response = client.get(f"/api/v1/screen/{TEST_JOB_ID}/candidates")

            assert response.status_code == 200
            candidate = response.json()["candidates"][0]

            # Verify all expected fields are present
            assert "application_id" in candidate
            assert "candidate_id" in candidate
            assert "candidate" in candidate
            assert "screening_score" in candidate
            assert "screening_recommendation" in candidate
            assert "strengths" in candidate
            assert "gaps" in candidate
            assert "red_flags" in candidate
            assert "status" in candidate
