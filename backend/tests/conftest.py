"""Pytest configuration and fixtures for TalentAI backend tests."""

import os
import uuid
from collections.abc import AsyncGenerator, Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# Set test environment variables before importing app modules
os.environ["SUPABASE_URL"] = "https://test-project.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "test-service-key"
os.environ["GOOGLE_API_KEY"] = "test-google-api-key"
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "false"


# ==================== Mock Data ====================

TEST_USER_ID = str(uuid.uuid4())
TEST_JOB_ID = str(uuid.uuid4())
TEST_CANDIDATE_ID = str(uuid.uuid4())
TEST_APPLICATION_ID = str(uuid.uuid4())
TEST_ASSESSMENT_ID = str(uuid.uuid4())


def mock_job_data() -> dict[str, Any]:
    """Generate mock job data."""
    return {
        "id": TEST_JOB_ID,
        "title": "Senior Software Engineer",
        "department": "Engineering",
        "location": "San Francisco, CA",
        "job_type": "full-time",
        "remote_policy": "hybrid",
        "summary": "We are looking for a Senior Software Engineer to join our team.",
        "description": "You will be responsible for designing, developing, and maintaining software systems.",
        "responsibilities": [
            "Design and implement scalable software solutions",
            "Review code and mentor junior engineers",
            "Collaborate with product team on requirements",
        ],
        "qualifications": {
            "required": ["5+ years of software development experience", "Python proficiency"],
            "preferred": ["Experience with FastAPI", "AWS experience"],
        },
        "skills_matrix": {
            "required": [
                {"skill": "Python", "proficiency": "advanced", "weight": 0.9},
                {"skill": "SQL", "proficiency": "intermediate", "weight": 0.7},
            ],
            "nice_to_have": [
                {"skill": "Docker", "proficiency": "intermediate", "weight": 0.5},
            ],
        },
        "evaluation_criteria": [
            {
                "criterion": "Technical Skills",
                "weight": 40,
                "description": "Coding ability and system design",
                "assessment_method": "technical",
            },
            {
                "criterion": "Communication",
                "weight": 30,
                "description": "Ability to explain technical concepts",
                "assessment_method": "behavioral",
            },
        ],
        "suggested_questions": {
            "technical": ["Explain your experience with Python async programming"],
            "behavioral": ["Describe a challenging project you led"],
            "situational": ["How would you handle a production outage?"],
        },
        "salary_range": {"min": 150000, "max": 200000, "currency": "USD"},
        "status": "draft",
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z",
    }


def mock_candidate_data() -> dict[str, Any]:
    """Generate mock candidate data."""
    return {
        "id": TEST_CANDIDATE_ID,
        "email": "john.doe@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1-555-123-4567",
        "linkedin_url": "https://linkedin.com/in/johndoe",
        "resume_url": "https://storage.example.com/resumes/johndoe.pdf",
        "resume_parsed": {
            "raw_text": "Senior Software Engineer with 7 years of experience...",
            "email": "john.doe@example.com",
            "sections": {"name": "John Doe"},
        },
        "source": "direct",
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z",
    }


def mock_application_data() -> dict[str, Any]:
    """Generate mock application data."""
    return {
        "id": TEST_APPLICATION_ID,
        "job_id": TEST_JOB_ID,
        "candidate_id": TEST_CANDIDATE_ID,
        "status": "screening",
        "screening_score": 85,
        "screening_recommendation": "strong_match",
        "match_breakdown": {
            "required_skills_match": 90,
            "nice_to_have_match": 70,
            "experience_match": 85,
            "education_match": 80,
        },
        "strengths": ["Strong Python skills", "Good communication"],
        "gaps": ["Limited AWS experience"],
        "red_flags": [],
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z",
    }


def mock_assessment_data() -> dict[str, Any]:
    """Generate mock assessment data."""
    return {
        "id": TEST_ASSESSMENT_ID,
        "application_id": TEST_APPLICATION_ID,
        "assessment_type": "video",
        "questions": [
            {
                "question_id": "q1",
                "question_type": "technical",
                "question_text": "Explain Python's GIL and its implications.",
                "time_limit": 180,
                "rubric": {"excellent": "Comprehensive explanation with examples"},
                "key_topics": ["GIL", "threading", "multiprocessing"],
            }
        ],
        "status": "pending",
        "access_token": "test-access-token-12345",
        "token_expires_at": "2024-01-22T10:00:00Z",
        "scheduled_duration_minutes": 30,
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z",
    }


# ==================== Fixtures ====================


@pytest.fixture
def mock_supabase_client() -> MagicMock:
    """Create a mock Supabase client."""
    client = MagicMock()

    # Mock table operations
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.delete.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.limit.return_value = table_mock

    # Default execute returns empty data
    execute_result = MagicMock()
    execute_result.data = []
    table_mock.execute.return_value = execute_result

    client.table.return_value = table_mock
    return client


@pytest.fixture
def mock_supabase_service(mock_supabase_client: MagicMock) -> MagicMock:
    """Create a mock SupabaseService."""
    service = MagicMock()
    service.client = mock_supabase_client

    # Mock async methods
    service.create_job = AsyncMock(return_value=mock_job_data())
    service.get_job = AsyncMock(return_value=mock_job_data())
    service.update_job = AsyncMock(return_value=mock_job_data())
    service.list_jobs = AsyncMock(return_value=[mock_job_data()])

    service.create_candidate = AsyncMock(return_value=mock_candidate_data())
    service.get_candidate = AsyncMock(return_value=mock_candidate_data())
    service.update_candidate = AsyncMock(return_value=mock_candidate_data())
    service.upsert_candidate = AsyncMock(return_value=mock_candidate_data())

    service.create_application = AsyncMock(return_value=mock_application_data())
    service.get_application = AsyncMock(return_value=mock_application_data())
    service.update_application = AsyncMock(return_value=mock_application_data())
    service.list_applications_for_job = AsyncMock(return_value=[mock_application_data()])

    service.create_assessment = AsyncMock(return_value=mock_assessment_data())
    service.get_assessment = AsyncMock(return_value=mock_assessment_data())
    service.update_assessment = AsyncMock(return_value=mock_assessment_data())
    service.get_assessment_by_token = AsyncMock(return_value=mock_assessment_data())

    return service


@pytest.fixture
def mock_gemini_client() -> MagicMock:
    """Create a mock Gemini client."""
    client = MagicMock()
    client.generate_content = MagicMock()
    client.generate_content_async = AsyncMock()
    return client


@pytest.fixture
def mock_agent_coordinator() -> MagicMock:
    """Create a mock AgentCoordinator."""
    coordinator = MagicMock()

    # Mock JD Assist
    coordinator.run_jd_assist = AsyncMock(
        return_value={
            "title": "Senior Software Engineer",
            "department": "Engineering",
            "location": "San Francisco, CA",
            "job_type": "full-time",
            "remote_policy": "hybrid",
            "summary": "We are looking for a Senior Software Engineer.",
            "description": "Full job description here.",
            "responsibilities": ["Design systems", "Write code"],
            "qualifications": {
                "required": ["5+ years experience"],
                "preferred": ["AWS experience"],
            },
            "skills_matrix": {
                "required": [{"skill": "Python", "proficiency": "advanced", "weight": 0.9}],
                "nice_to_have": [],
            },
            "evaluation_criteria": [],
            "suggested_questions": {"technical": [], "behavioral": [], "situational": []},
            "salary_range": {"min": 150000, "max": 200000, "currency": "USD"},
        }
    )

    # Mock Talent Screener
    coordinator.run_talent_screener = AsyncMock(
        return_value={
            "overall_score": 85,
            "recommendation": "strong_match",
            "match_breakdown": {
                "required_skills_match": 90,
                "nice_to_have_match": 70,
                "experience_match": 85,
                "education_match": 80,
            },
            "strengths": ["Strong Python skills"],
            "gaps": ["Limited cloud experience"],
            "red_flags": [],
        }
    )

    # Mock Assessment Questions
    coordinator.run_assessor_questions = AsyncMock(
        return_value={
            "questions": [
                {
                    "question_id": "q1",
                    "question_type": "technical",
                    "question_text": "Explain Python async/await.",
                    "time_limit": 180,
                    "rubric": {},
                    "key_topics": ["async", "await", "coroutines"],
                }
            ],
            "instructions": {"preparation": "Review async programming concepts"},
        }
    )

    # Mock Video Analysis
    coordinator.run_video_analysis = AsyncMock(
        return_value={
            "overall_score": 82,
            "recommendation": "YES",
            "confidence_level": "high",
            "response_analysis": [],
            "summary": {"top_strengths": ["Clear communication"]},
        }
    )

    # Mock Offer Generator
    coordinator.run_offer_generator = AsyncMock(
        return_value={
            "base_salary": 175000,
            "signing_bonus": 10000,
            "equity": {"shares": 5000, "vesting_schedule": "4 years with 1 year cliff"},
            "benefits": ["Health insurance", "401k matching"],
            "offer_letter": "Dear John...",
        }
    )

    return coordinator


@pytest.fixture
def test_user() -> dict[str, Any]:
    """Return test user data."""
    return {
        "id": TEST_USER_ID,
        "email": "testuser@example.com",
        "full_name": "Test User",
        "role": "recruiter",
    }


# ==================== App Fixtures ====================


@pytest.fixture
def app(mock_supabase_service: MagicMock, mock_agent_coordinator: MagicMock) -> FastAPI:
    """Create FastAPI app with mocked dependencies."""
    # Patch dependencies before importing app
    with (
        patch("app.services.supabase.db", mock_supabase_service),
        patch("app.agents.coordinator.agent_coordinator", mock_agent_coordinator),
        patch("app.api.v1.jd.db", mock_supabase_service),
        patch("app.api.v1.jd.agent_coordinator", mock_agent_coordinator),
        patch("app.api.v1.screening.db", mock_supabase_service),
        patch("app.api.v1.screening.agent_coordinator", mock_agent_coordinator),
        patch("app.api.v1.assessment.db", mock_supabase_service),
        patch("app.api.v1.assessment.agent_coordinator", mock_agent_coordinator),
    ):
        from app.main import app as fastapi_app

        yield fastapi_app


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    """Create test client."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ==================== Storage Fixtures ====================


@pytest.fixture
def mock_storage() -> MagicMock:
    """Create a mock storage service."""
    storage = MagicMock()
    storage.upload_resume = AsyncMock(return_value="https://storage.example.com/resumes/test.pdf")
    storage.upload_video = AsyncMock(return_value="https://storage.example.com/videos/test.webm")
    storage.get_signed_url = MagicMock(return_value="https://storage.example.com/signed/test")
    return storage


@pytest.fixture
def mock_document_parser() -> MagicMock:
    """Create a mock document parser."""
    parser = MagicMock()
    parser.parse_resume = MagicMock(
        return_value={
            "raw_text": "John Doe\nSenior Software Engineer\n7 years experience...",
            "email": "john.doe@example.com",
            "phone": "+1-555-123-4567",
            "linkedin": "https://linkedin.com/in/johndoe",
            "sections": {
                "name": "John Doe",
                "experience": "7 years",
            },
        }
    )
    return parser


# ==================== Test Data Fixtures ====================


@pytest.fixture
def sample_job_create_data() -> dict[str, Any]:
    """Return sample job creation data."""
    return {
        "input_type": "text",
        "input_text": "We need a Senior Software Engineer with Python experience for our backend team.",
        "department": "Engineering",
        "hiring_manager": "Jane Smith",
        "urgency": "normal",
    }


@pytest.fixture
def sample_job_update_data() -> dict[str, Any]:
    """Return sample job update data."""
    return {
        "title": "Staff Software Engineer",
        "department": "Platform Engineering",
        "salary_range": {"min": 180000, "max": 220000, "currency": "USD"},
    }


@pytest.fixture
def sample_resume_content() -> bytes:
    """Return sample resume content."""
    return b"%PDF-1.4 sample resume content"


# ==================== Async Support ====================


@pytest.fixture(scope="session")
def event_loop_policy():
    """Set event loop policy for async tests."""
    import asyncio

    return asyncio.DefaultEventLoopPolicy()
