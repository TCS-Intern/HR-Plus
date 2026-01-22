"""Unit tests for AgentCoordinator."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    TEST_CANDIDATE_ID,
    TEST_JOB_ID,
    mock_candidate_data,
    mock_job_data,
)


class TestAgentCoordinator:
    """Test cases for AgentCoordinator class."""

    @pytest.fixture
    def coordinator(self):
        """Create a coordinator with mocked agents."""
        with (
            patch("app.agents.coordinator.jd_assist_agent"),
            patch("app.agents.coordinator.talent_screener_agent"),
            patch("app.agents.coordinator.talent_assessor_agent"),
            patch("app.agents.coordinator.talent_assessor_questions_agent"),
            patch("app.agents.coordinator.offer_generator_agent"),
            patch("app.agents.coordinator.phone_screen_agent"),
        ):
            from app.agents.coordinator import AgentCoordinator

            return AgentCoordinator()

    @pytest.fixture
    def mock_runner(self):
        """Create a mock InMemoryRunner."""
        runner = MagicMock()
        runner.session_service = MagicMock()
        runner.session_service.create_session = AsyncMock(
            return_value=MagicMock(id="test-session-id")
        )
        runner.close = AsyncMock()
        return runner

    async def test_run_jd_assist_with_text_input(self, coordinator, mock_runner):
        """Test JD assist agent with text input."""
        input_data = {
            "input_type": "text",
            "input_text": "We need a Python developer with FastAPI experience",
            "department": "Engineering",
            "hiring_manager": "Jane Smith",
            "urgency": "normal",
        }

        expected_response = {
            "title": "Python Developer",
            "department": "Engineering",
            "job_type": "full-time",
            "responsibilities": ["Write Python code", "Build APIs"],
        }

        # Mock the _run_agent method
        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_jd_assist(input_data)

            assert result == expected_response
            assert coordinator._run_agent.called

    async def test_run_jd_assist_with_voice_input(self, coordinator):
        """Test JD assist agent with voice transcript."""
        input_data = {
            "input_type": "voice",
            "voice_transcript": "I need someone who can lead a team and write Python code",
            "department": "Engineering",
        }

        expected_response = {
            "title": "Engineering Lead",
            "department": "Engineering",
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_jd_assist(input_data)

            assert result == expected_response

    async def test_run_talent_screener(self, coordinator):
        """Test talent screener agent."""
        job_data = mock_job_data()
        candidates = [
            {
                **mock_candidate_data(),
                "resume_text": "Senior Python developer with 7 years experience...",
            }
        ]

        expected_response = {
            "screening_results": [
                {
                    "candidate_id": TEST_CANDIDATE_ID,
                    "overall_score": 85,
                    "recommendation": "strong_match",
                }
            ],
            "summary": {
                "total_screened": 1,
                "strong_matches": 1,
            },
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_talent_screener(job_data, candidates)

            assert result == expected_response
            assert coordinator._run_agent.called

    async def test_run_talent_screener_multiple_candidates(self, coordinator):
        """Test screening multiple candidates."""
        job_data = mock_job_data()
        candidates = [
            {**mock_candidate_data(), "id": "c1", "resume_text": "Strong Python developer"},
            {**mock_candidate_data(), "id": "c2", "resume_text": "Junior developer"},
        ]

        expected_response = {
            "screening_results": [
                {"candidate_id": "c1", "overall_score": 90, "recommendation": "strong_match"},
                {"candidate_id": "c2", "overall_score": 45, "recommendation": "weak_match"},
            ],
            "summary": {
                "total_screened": 2,
                "strong_matches": 1,
            },
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_talent_screener(job_data, candidates)

            assert len(result["screening_results"]) == 2

    async def test_run_assessor_questions(self, coordinator):
        """Test assessment questions generation."""
        expected_response = {
            "questions": [
                {
                    "question_id": "q1",
                    "question_type": "technical",
                    "question_text": "Explain Python async/await",
                    "time_limit": 180,
                }
            ],
            "instructions": {},
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_assessor_questions(TEST_JOB_ID, TEST_CANDIDATE_ID)

            assert "questions" in result
            assert len(result["questions"]) > 0

    async def test_run_video_analysis(self, coordinator):
        """Test video analysis."""
        questions = [{"question_id": "q1", "question_text": "Tell me about yourself"}]
        job_requirements = {
            "title": "Software Engineer",
            "skills_matrix": {"required": [{"skill": "Python"}]},
        }

        expected_response = {
            "overall_score": 82,
            "recommendation": "YES",
            "confidence_level": "high",
            "response_analysis": [],
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_video_analysis(
                "https://storage.example.com/video.webm", questions, job_requirements
            )

            assert result["overall_score"] == 82
            assert result["recommendation"] == "YES"

    async def test_run_phone_screen_analysis(self, coordinator):
        """Test phone screen transcript analysis."""
        transcript = [
            {"role": "assistant", "content": "Hello, can you tell me about yourself?"},
            {"role": "user", "content": "I'm a senior developer with 7 years experience."},
            {"role": "assistant", "content": "What are your salary expectations?"},
            {"role": "user", "content": "I'm looking for around 180k."},
        ]
        job_requirements = {
            "title": "Senior Software Engineer",
            "skills_matrix": {"required": [{"skill": "Python"}]},
        }

        expected_response = {
            "overall_score": 78,
            "recommendation": "YES",
            "skills_discussed": [{"skill": "Python", "proficiency": "advanced"}],
            "compensation_expectations": {"min_salary": 180000, "max_salary": None},
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_phone_screen_analysis(transcript, job_requirements)

            assert "overall_score" in result

    async def test_run_offer_generator(self, coordinator):
        """Test offer generation."""
        offer_input = {
            "application_id": "app-123",
            "candidate_name": "John Doe",
            "candidate_email": "john@example.com",
            "job_title": "Senior Software Engineer",
            "department": "Engineering",
            "salary_range_min": 150000,
            "salary_range_max": 200000,
            "experience_years": 7,
            "assessment_score": 85,
        }

        expected_response = {
            "base_salary": 175000,
            "signing_bonus": 15000,
            "equity": {"shares": 5000},
            "benefits": ["Health insurance", "401k"],
            "offer_letter": "Dear John Doe...",
        }

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_offer_generator(offer_input)

            assert result["base_salary"] == 175000
            assert "offer_letter" in result

    async def test_run_agent_parses_json_response(self, coordinator):
        """Test that _run_agent correctly parses JSON from response."""
        # Create a mock event with JSON content
        mock_content = MagicMock()
        mock_part = MagicMock()
        mock_part.text = '{"title": "Test Job", "department": "Engineering"}'
        mock_content.parts = [mock_part]

        mock_event = MagicMock()
        mock_event.content = mock_content

        with patch("app.agents.coordinator.InMemoryRunner") as MockRunner:
            runner_instance = MagicMock()
            runner_instance.session_service.create_session = AsyncMock(
                return_value=MagicMock(id="test-session")
            )
            runner_instance.close = AsyncMock()

            # Create async generator for run_async
            async def mock_run_async(*args, **kwargs):
                yield mock_event

            runner_instance.run_async = mock_run_async
            MockRunner.return_value = runner_instance

            # Import and test
            from app.agents.coordinator import AgentCoordinator

            coord = AgentCoordinator()

            # We need to patch the jd_assist_agent for this test
            mock_agent = MagicMock()
            mock_agent.name = "test_agent"

            result = await coord._run_agent(mock_agent, "test input")

            assert result["title"] == "Test Job"
            assert result["department"] == "Engineering"

    async def test_run_agent_handles_markdown_json(self, coordinator):
        """Test that _run_agent handles markdown-wrapped JSON."""
        mock_content = MagicMock()
        mock_part = MagicMock()
        mock_part.text = '```json\n{"title": "Test Job"}\n```'
        mock_content.parts = [mock_part]

        mock_event = MagicMock()
        mock_event.content = mock_content

        with patch("app.agents.coordinator.InMemoryRunner") as MockRunner:
            runner_instance = MagicMock()
            runner_instance.session_service.create_session = AsyncMock(
                return_value=MagicMock(id="test-session")
            )
            runner_instance.close = AsyncMock()

            async def mock_run_async(*args, **kwargs):
                yield mock_event

            runner_instance.run_async = mock_run_async
            MockRunner.return_value = runner_instance

            from app.agents.coordinator import AgentCoordinator

            coord = AgentCoordinator()
            mock_agent = MagicMock()
            mock_agent.name = "test_agent"

            result = await coord._run_agent(mock_agent, "test input")

            assert result["title"] == "Test Job"

    async def test_run_agent_handles_invalid_json(self, coordinator):
        """Test that _run_agent handles non-JSON responses gracefully."""
        mock_content = MagicMock()
        mock_part = MagicMock()
        mock_part.text = "This is not valid JSON response"
        mock_content.parts = [mock_part]

        mock_event = MagicMock()
        mock_event.content = mock_content

        with patch("app.agents.coordinator.InMemoryRunner") as MockRunner:
            runner_instance = MagicMock()
            runner_instance.session_service.create_session = AsyncMock(
                return_value=MagicMock(id="test-session")
            )
            runner_instance.close = AsyncMock()

            async def mock_run_async(*args, **kwargs):
                yield mock_event

            runner_instance.run_async = mock_run_async
            MockRunner.return_value = runner_instance

            from app.agents.coordinator import AgentCoordinator

            coord = AgentCoordinator()
            mock_agent = MagicMock()
            mock_agent.name = "test_agent"

            result = await coord._run_agent(mock_agent, "test input")

            # Should return the raw response wrapped in "response" key
            assert "response" in result
            assert result["response"] == "This is not valid JSON response"


class TestAgentCoordinatorErrorHandling:
    """Test error handling in AgentCoordinator."""

    @pytest.fixture
    def coordinator(self):
        """Create coordinator with mocked agents."""
        with (
            patch("app.agents.coordinator.jd_assist_agent"),
            patch("app.agents.coordinator.talent_screener_agent"),
            patch("app.agents.coordinator.talent_assessor_agent"),
            patch("app.agents.coordinator.talent_assessor_questions_agent"),
            patch("app.agents.coordinator.offer_generator_agent"),
            patch("app.agents.coordinator.phone_screen_agent"),
        ):
            from app.agents.coordinator import AgentCoordinator

            return AgentCoordinator()

    async def test_run_agent_handles_empty_response(self, coordinator):
        """Test handling of empty response from agent."""
        mock_event = MagicMock()
        mock_event.content = None

        with patch("app.agents.coordinator.InMemoryRunner") as MockRunner:
            runner_instance = MagicMock()
            runner_instance.session_service.create_session = AsyncMock(
                return_value=MagicMock(id="test-session")
            )
            runner_instance.close = AsyncMock()

            async def mock_run_async(*args, **kwargs):
                yield mock_event

            runner_instance.run_async = mock_run_async
            MockRunner.return_value = runner_instance

            from app.agents.coordinator import AgentCoordinator

            coord = AgentCoordinator()
            mock_agent = MagicMock()
            mock_agent.name = "test_agent"

            result = await coord._run_agent(mock_agent, "test input")

            assert "response" in result
            assert result["response"] == ""

    async def test_run_jd_assist_with_missing_fields(self, coordinator):
        """Test JD assist with minimal input."""
        input_data = {
            "input_type": "text",
            # Missing most optional fields
        }

        expected_response = {"title": "Untitled Position"}

        with patch.object(coordinator, "_run_agent", new=AsyncMock(return_value=expected_response)):
            result = await coordinator.run_jd_assist(input_data)
            assert result is not None
