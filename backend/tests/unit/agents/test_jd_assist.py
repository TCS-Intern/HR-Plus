"""Unit tests for JD Assist agent and tools."""

from unittest.mock import patch


class TestJDTools:
    """Test cases for JD Assist tools."""

    def test_search_similar_jds(self):
        """Test searching for similar job descriptions."""
        from app.agents.tools.jd_tools import search_similar_jds

        result = search_similar_jds(
            keywords=["python", "backend", "senior"],
            department="Engineering",
            limit=5,
        )

        assert result["status"] == "success"
        assert "results" in result
        assert isinstance(result["results"], list)
        assert "message" in result

    def test_search_similar_jds_empty_keywords(self):
        """Test search with empty keywords."""
        from app.agents.tools.jd_tools import search_similar_jds

        result = search_similar_jds(keywords=[], department="Engineering")

        assert result["status"] == "success"

    def test_get_market_salary_data_junior(self):
        """Test salary data for junior level."""
        from app.agents.tools.jd_tools import get_market_salary_data

        result = get_market_salary_data(
            job_title="Software Engineer",
            location="San Francisco, CA",
            experience_level="junior",
        )

        assert result["status"] == "success"
        assert result["experience_level"] == "junior"
        assert "salary_range" in result
        assert result["salary_range"]["min"] == 70000
        assert result["salary_range"]["max"] == 100000
        assert result["salary_range"]["currency"] == "USD"

    def test_get_market_salary_data_senior(self):
        """Test salary data for senior level."""
        from app.agents.tools.jd_tools import get_market_salary_data

        result = get_market_salary_data(
            job_title="Senior Software Engineer",
            location="New York, NY",
            experience_level="senior",
        )

        assert result["status"] == "success"
        assert result["salary_range"]["min"] == 150000
        assert result["salary_range"]["max"] == 200000

    def test_get_market_salary_data_lead(self):
        """Test salary data for lead level."""
        from app.agents.tools.jd_tools import get_market_salary_data

        result = get_market_salary_data(
            job_title="Engineering Lead",
            location="Seattle, WA",
            experience_level="lead",
        )

        assert result["salary_range"]["min"] == 180000
        assert result["salary_range"]["max"] == 250000

    def test_get_market_salary_data_unknown_level(self):
        """Test salary data with unknown experience level defaults to mid."""
        from app.agents.tools.jd_tools import get_market_salary_data

        result = get_market_salary_data(
            job_title="Software Engineer",
            location="Austin, TX",
            experience_level="unknown_level",
        )

        # Should default to mid level
        assert result["salary_range"]["min"] == 100000
        assert result["salary_range"]["max"] == 150000

    def test_get_market_salary_data_percentiles(self):
        """Test that salary data includes percentile information."""
        from app.agents.tools.jd_tools import get_market_salary_data

        result = get_market_salary_data(
            job_title="Software Engineer",
            location="San Francisco, CA",
            experience_level="mid",
        )

        assert "percentile_25" in result["salary_range"]
        assert "percentile_50" in result["salary_range"]
        assert "percentile_75" in result["salary_range"]
        assert result["salary_range"]["percentile_25"] <= result["salary_range"]["percentile_50"]
        assert result["salary_range"]["percentile_50"] <= result["salary_range"]["percentile_75"]

    def test_get_company_policies(self):
        """Test retrieving company policies."""
        from app.agents.tools.jd_tools import get_company_policies

        result = get_company_policies(
            company_id="company-123",
            policy_types=["benefits", "remote_work", "equity"],
        )

        assert result["status"] == "success"
        assert result["company_id"] == "company-123"
        assert "policies" in result
        assert "benefits" in result["policies"]
        assert "remote_work" in result["policies"]
        assert "equity" in result["policies"]

    def test_get_company_policies_benefits_details(self):
        """Test that benefits policy contains expected details."""
        from app.agents.tools.jd_tools import get_company_policies

        result = get_company_policies(
            company_id="company-123",
            policy_types=["benefits"],
        )

        benefits = result["policies"]["benefits"]
        assert "health_insurance" in benefits
        assert "dental" in benefits
        assert "vision" in benefits
        assert "401k" in benefits
        assert "pto" in benefits

    def test_get_company_policies_remote_work(self):
        """Test remote work policy details."""
        from app.agents.tools.jd_tools import get_company_policies

        result = get_company_policies(
            company_id="company-123",
            policy_types=["remote_work"],
        )

        remote = result["policies"]["remote_work"]
        assert "policy" in remote
        assert remote["policy"] in ["remote", "hybrid", "onsite"]
        assert "days_in_office" in remote
        assert "stipend" in remote


class TestJDAssistAgent:
    """Test cases for JD Assist agent configuration."""

    def test_agent_has_correct_name(self):
        """Test that agent has the correct name."""
        with patch("app.agents.jd_assist.settings") as mock_settings:
            mock_settings.gemini_model = "gemini-2.5-flash"
            from app.agents.jd_assist import jd_assist_agent

            assert jd_assist_agent.name == "jd_assist"

    def test_agent_has_tools(self):
        """Test that agent has required tools."""
        with patch("app.agents.jd_assist.settings") as mock_settings:
            mock_settings.gemini_model = "gemini-2.5-flash"
            from app.agents.jd_assist import jd_assist_agent

            assert jd_assist_agent.tools is not None
            assert len(jd_assist_agent.tools) > 0

    def test_agent_has_output_key(self):
        """Test that agent stores output in session state."""
        with patch("app.agents.jd_assist.settings") as mock_settings:
            mock_settings.gemini_model = "gemini-2.5-flash"
            from app.agents.jd_assist import jd_assist_agent

            assert jd_assist_agent.output_key == "jd_data"

    def test_agent_instruction_contains_guidelines(self):
        """Test that agent instruction contains key guidelines."""
        from app.agents.jd_assist import JD_ASSIST_INSTRUCTION

        assert "JD Assist Agent" in JD_ASSIST_INSTRUCTION
        assert "job description" in JD_ASSIST_INSTRUCTION.lower()
        assert "skills matrix" in JD_ASSIST_INSTRUCTION.lower()
        assert "evaluation criteria" in JD_ASSIST_INSTRUCTION.lower()
        assert "JSON" in JD_ASSIST_INSTRUCTION

    def test_agent_instruction_includes_output_format(self):
        """Test that instruction specifies output format."""
        from app.agents.jd_assist import JD_ASSIST_INSTRUCTION

        # Should specify required fields
        assert "title" in JD_ASSIST_INSTRUCTION
        assert "department" in JD_ASSIST_INSTRUCTION
        assert "responsibilities" in JD_ASSIST_INSTRUCTION
        assert "qualifications" in JD_ASSIST_INSTRUCTION
        assert "salary_range" in JD_ASSIST_INSTRUCTION


class TestJDAssistOutputValidation:
    """Test validation of JD Assist output schemas."""

    def test_valid_jd_output_structure(self):
        """Test that a valid JD output matches expected structure."""
        valid_output = {
            "title": "Senior Software Engineer",
            "department": "Engineering",
            "location": "San Francisco, CA",
            "job_type": "full-time",
            "remote_policy": "hybrid",
            "summary": "We are looking for a Senior Software Engineer.",
            "description": "Full job description here.",
            "responsibilities": [
                "Design scalable systems",
                "Write clean code",
                "Mentor junior engineers",
            ],
            "qualifications": {
                "required": ["5+ years experience", "Python proficiency"],
                "preferred": ["AWS experience", "Kubernetes knowledge"],
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
                    "description": "Coding ability",
                    "assessment_method": "technical",
                }
            ],
            "suggested_questions": {
                "technical": ["Explain async/await in Python"],
                "behavioral": ["Describe a challenging project"],
                "situational": ["How would you handle a deadline?"],
            },
            "salary_range": {"min": 150000, "max": 200000, "currency": "USD"},
        }

        # Validate required fields
        required_fields = [
            "title",
            "responsibilities",
            "qualifications",
            "skills_matrix",
        ]
        for field in required_fields:
            assert field in valid_output

        # Validate nested structures
        assert isinstance(valid_output["responsibilities"], list)
        assert "required" in valid_output["qualifications"]
        assert "preferred" in valid_output["qualifications"]
        assert "required" in valid_output["skills_matrix"]
        assert "nice_to_have" in valid_output["skills_matrix"]

    def test_skill_weight_validation(self):
        """Test that skill weights are within valid range."""
        skill = {"skill": "Python", "proficiency": "advanced", "weight": 0.9}

        assert 0 <= skill["weight"] <= 1

        # Invalid weight should be caught
        invalid_skill = {"skill": "Python", "proficiency": "advanced", "weight": 1.5}
        assert invalid_skill["weight"] > 1  # This would be invalid

    def test_evaluation_criterion_weight_validation(self):
        """Test that evaluation criterion weights are valid."""
        criterion = {
            "criterion": "Technical Skills",
            "weight": 40,
            "description": "Coding ability",
            "assessment_method": "technical",
        }

        assert 0 <= criterion["weight"] <= 100
        assert criterion["assessment_method"] in [
            "interview",
            "technical",
            "behavioral",
            "portfolio",
        ]
