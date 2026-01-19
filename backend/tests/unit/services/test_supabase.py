"""Unit tests for Supabase service."""

from unittest.mock import MagicMock, AsyncMock, patch
import pytest

from tests.conftest import (
    TEST_JOB_ID,
    TEST_CANDIDATE_ID,
    TEST_APPLICATION_ID,
    TEST_ASSESSMENT_ID,
    mock_job_data,
    mock_candidate_data,
    mock_application_data,
    mock_assessment_data,
)


class TestSupabaseServiceJobs:
    """Test cases for job-related Supabase operations."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.insert.return_value = table_mock
        table_mock.update.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        client.table.return_value = table_mock
        return client

    @pytest.fixture
    def service(self, mock_client):
        """Create SupabaseService with mock client."""
        with patch("app.services.supabase.get_supabase_client", return_value=mock_client):
            from app.services.supabase import SupabaseService

            svc = SupabaseService()
            svc.client = mock_client
            return svc

    async def test_create_job(self, service, mock_client):
        """Test creating a new job."""
        job_data = mock_job_data()
        execute_result = MagicMock()
        execute_result.data = [job_data]
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.create_job(job_data)

        assert result["id"] == TEST_JOB_ID
        assert result["title"] == "Senior Software Engineer"
        mock_client.table.assert_called_with("jobs")

    async def test_create_job_empty_response(self, service, mock_client):
        """Test creating a job with empty response."""
        execute_result = MagicMock()
        execute_result.data = []
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.create_job({})

        assert result == {}

    async def test_get_job(self, service, mock_client):
        """Test getting a job by ID."""
        job_data = mock_job_data()
        execute_result = MagicMock()
        execute_result.data = [job_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_job(TEST_JOB_ID)

        assert result is not None
        assert result["id"] == TEST_JOB_ID
        mock_client.table.return_value.select.assert_called_with("*")

    async def test_get_job_not_found(self, service, mock_client):
        """Test getting a non-existent job."""
        execute_result = MagicMock()
        execute_result.data = []
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_job("non-existent-id")

        assert result is None

    async def test_update_job(self, service, mock_client):
        """Test updating a job."""
        updated_data = mock_job_data()
        updated_data["title"] = "Staff Software Engineer"
        execute_result = MagicMock()
        execute_result.data = [updated_data]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.update_job(TEST_JOB_ID, {"title": "Staff Software Engineer"})

        assert result["title"] == "Staff Software Engineer"

    async def test_list_jobs(self, service, mock_client):
        """Test listing jobs."""
        jobs = [mock_job_data(), mock_job_data()]
        jobs[1]["id"] = "job-2"
        execute_result = MagicMock()
        execute_result.data = jobs
        mock_client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            execute_result
        )

        result = await service.list_jobs()

        assert len(result) == 2

    async def test_list_jobs_with_status_filter(self, service, mock_client):
        """Test listing jobs with status filter."""
        jobs = [mock_job_data()]
        execute_result = MagicMock()
        execute_result.data = jobs
        mock_client.table.return_value.select.return_value.order.return_value.limit.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.list_jobs(status="active")

        assert len(result) == 1


class TestSupabaseServiceCandidates:
    """Test cases for candidate-related Supabase operations."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.insert.return_value = table_mock
        table_mock.update.return_value = table_mock
        table_mock.upsert.return_value = table_mock
        table_mock.eq.return_value = table_mock
        client.table.return_value = table_mock
        return client

    @pytest.fixture
    def service(self, mock_client):
        """Create SupabaseService with mock client."""
        with patch("app.services.supabase.get_supabase_client", return_value=mock_client):
            from app.services.supabase import SupabaseService

            svc = SupabaseService()
            svc.client = mock_client
            return svc

    async def test_create_candidate(self, service, mock_client):
        """Test creating a new candidate."""
        candidate_data = mock_candidate_data()
        execute_result = MagicMock()
        execute_result.data = [candidate_data]
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.create_candidate(candidate_data)

        assert result["id"] == TEST_CANDIDATE_ID
        assert result["email"] == "john.doe@example.com"
        mock_client.table.assert_called_with("candidates")

    async def test_get_candidate(self, service, mock_client):
        """Test getting a candidate by ID."""
        candidate_data = mock_candidate_data()
        execute_result = MagicMock()
        execute_result.data = [candidate_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_candidate(TEST_CANDIDATE_ID)

        assert result is not None
        assert result["email"] == "john.doe@example.com"

    async def test_get_candidate_by_email(self, service, mock_client):
        """Test getting a candidate by email."""
        candidate_data = mock_candidate_data()
        execute_result = MagicMock()
        execute_result.data = [candidate_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_candidate_by_email("john.doe@example.com")

        assert result is not None
        assert result["id"] == TEST_CANDIDATE_ID

    async def test_upsert_candidate(self, service, mock_client):
        """Test upserting a candidate."""
        candidate_data = mock_candidate_data()
        execute_result = MagicMock()
        execute_result.data = [candidate_data]
        mock_client.table.return_value.upsert.return_value.execute.return_value = execute_result

        result = await service.upsert_candidate(candidate_data)

        assert result["id"] == TEST_CANDIDATE_ID
        mock_client.table.return_value.upsert.assert_called_with(
            candidate_data, on_conflict="email"
        )


class TestSupabaseServiceApplications:
    """Test cases for application-related Supabase operations."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.insert.return_value = table_mock
        table_mock.update.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        client.table.return_value = table_mock
        return client

    @pytest.fixture
    def service(self, mock_client):
        """Create SupabaseService with mock client."""
        with patch("app.services.supabase.get_supabase_client", return_value=mock_client):
            from app.services.supabase import SupabaseService

            svc = SupabaseService()
            svc.client = mock_client
            return svc

    async def test_create_application(self, service, mock_client):
        """Test creating a new application."""
        application_data = mock_application_data()
        execute_result = MagicMock()
        execute_result.data = [application_data]
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.create_application(application_data)

        assert result["id"] == TEST_APPLICATION_ID
        assert result["status"] == "screening"
        mock_client.table.assert_called_with("applications")

    async def test_get_application(self, service, mock_client):
        """Test getting an application by ID."""
        application_data = mock_application_data()
        execute_result = MagicMock()
        execute_result.data = [application_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_application(TEST_APPLICATION_ID)

        assert result is not None
        assert result["screening_score"] == 85

    async def test_update_application(self, service, mock_client):
        """Test updating an application."""
        updated_data = mock_application_data()
        updated_data["status"] = "shortlisted"
        execute_result = MagicMock()
        execute_result.data = [updated_data]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.update_application(
            TEST_APPLICATION_ID, {"status": "shortlisted"}
        )

        assert result["status"] == "shortlisted"

    async def test_list_applications_for_job(self, service, mock_client):
        """Test listing applications for a job."""
        applications = [mock_application_data()]
        execute_result = MagicMock()
        execute_result.data = applications
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            execute_result
        )

        result = await service.list_applications_for_job(TEST_JOB_ID)

        assert len(result) == 1
        # Verify candidate data is requested
        mock_client.table.return_value.select.assert_called_with("*, candidates(*)")


class TestSupabaseServiceAssessments:
    """Test cases for assessment-related Supabase operations."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.insert.return_value = table_mock
        table_mock.update.return_value = table_mock
        table_mock.eq.return_value = table_mock
        client.table.return_value = table_mock
        return client

    @pytest.fixture
    def service(self, mock_client):
        """Create SupabaseService with mock client."""
        with patch("app.services.supabase.get_supabase_client", return_value=mock_client):
            from app.services.supabase import SupabaseService

            svc = SupabaseService()
            svc.client = mock_client
            return svc

    async def test_create_assessment(self, service, mock_client):
        """Test creating a new assessment."""
        assessment_data = mock_assessment_data()
        execute_result = MagicMock()
        execute_result.data = [assessment_data]
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.create_assessment(assessment_data)

        assert result["id"] == TEST_ASSESSMENT_ID
        assert result["assessment_type"] == "video"
        mock_client.table.assert_called_with("assessments")

    async def test_get_assessment(self, service, mock_client):
        """Test getting an assessment by ID."""
        assessment_data = mock_assessment_data()
        execute_result = MagicMock()
        execute_result.data = [assessment_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_assessment(TEST_ASSESSMENT_ID)

        assert result is not None
        assert result["status"] == "pending"

    async def test_get_assessment_by_token(self, service, mock_client):
        """Test getting an assessment by access token."""
        assessment_data = mock_assessment_data()
        execute_result = MagicMock()
        execute_result.data = [assessment_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_assessment_by_token("test-access-token-12345")

        assert result is not None
        assert result["access_token"] == "test-access-token-12345"

    async def test_update_assessment(self, service, mock_client):
        """Test updating an assessment."""
        updated_data = mock_assessment_data()
        updated_data["status"] = "completed"
        execute_result = MagicMock()
        execute_result.data = [updated_data]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.update_assessment(
            TEST_ASSESSMENT_ID, {"status": "completed"}
        )

        assert result["status"] == "completed"


class TestSupabaseServiceAgentLogs:
    """Test cases for agent log operations."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.insert.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        client.table.return_value = table_mock
        return client

    @pytest.fixture
    def service(self, mock_client):
        """Create SupabaseService with mock client."""
        with patch("app.services.supabase.get_supabase_client", return_value=mock_client):
            from app.services.supabase import SupabaseService

            svc = SupabaseService()
            svc.client = mock_client
            return svc

    async def test_log_agent_activity(self, service, mock_client):
        """Test logging agent activity."""
        log_data = {
            "agent_type": "jd_assist",
            "action": "create_jd",
            "entity_type": "job",
            "entity_id": TEST_JOB_ID,
            "status": "success",
        }
        execute_result = MagicMock()
        execute_result.data = [log_data]
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.log_agent_activity(log_data)

        assert result["agent_type"] == "jd_assist"
        mock_client.table.assert_called_with("agent_logs")

    async def test_get_recent_agent_logs(self, service, mock_client):
        """Test getting recent agent logs."""
        logs = [
            {"agent_type": "jd_assist", "action": "create_jd"},
            {"agent_type": "screener", "action": "screen_candidates"},
        ]
        execute_result = MagicMock()
        execute_result.data = logs
        mock_client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_recent_agent_logs(limit=50)

        assert len(result) == 2


class TestSupabaseServicePhoneScreens:
    """Test cases for phone screen operations."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        table_mock = MagicMock()
        table_mock.select.return_value = table_mock
        table_mock.insert.return_value = table_mock
        table_mock.update.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        client.table.return_value = table_mock
        return client

    @pytest.fixture
    def service(self, mock_client):
        """Create SupabaseService with mock client."""
        with patch("app.services.supabase.get_supabase_client", return_value=mock_client):
            from app.services.supabase import SupabaseService

            svc = SupabaseService()
            svc.client = mock_client
            return svc

    async def test_create_phone_screen(self, service, mock_client):
        """Test creating a phone screen."""
        phone_screen_data = {
            "id": "ps-123",
            "application_id": TEST_APPLICATION_ID,
            "status": "scheduled",
        }
        execute_result = MagicMock()
        execute_result.data = [phone_screen_data]
        mock_client.table.return_value.insert.return_value.execute.return_value = execute_result

        result = await service.create_phone_screen(phone_screen_data)

        assert result["id"] == "ps-123"
        mock_client.table.assert_called_with("phone_screens")

    async def test_get_phone_screen_by_vapi_call_id(self, service, mock_client):
        """Test getting phone screen by Vapi call ID."""
        phone_screen_data = {
            "id": "ps-123",
            "vapi_call_id": "vapi-call-456",
            "status": "in_progress",
        }
        execute_result = MagicMock()
        execute_result.data = [phone_screen_data]
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            execute_result
        )

        result = await service.get_phone_screen_by_vapi_call_id("vapi-call-456")

        assert result["vapi_call_id"] == "vapi-call-456"
