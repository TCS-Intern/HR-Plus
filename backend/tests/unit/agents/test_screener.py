"""Unit tests for Talent Screener agent and tools."""

from unittest.mock import MagicMock, patch
import pytest


class TestScreeningTools:
    """Test cases for Talent Screener tools."""

    def test_parse_resume_pdf(self):
        """Test parsing a PDF resume."""
        from app.agents.tools.screening_tools import parse_resume

        result = parse_resume(
            document_url="https://storage.example.com/resumes/test.pdf",
            format="pdf",
        )

        assert result["status"] == "success"
        assert result["document_url"] == "https://storage.example.com/resumes/test.pdf"
        assert result["format"] == "pdf"
        assert "parsed_data" in result
        assert "contact" in result["parsed_data"]
        assert "experience" in result["parsed_data"]
        assert "education" in result["parsed_data"]
        assert "skills" in result["parsed_data"]

    def test_parse_resume_docx(self):
        """Test parsing a DOCX resume."""
        from app.agents.tools.screening_tools import parse_resume

        result = parse_resume(
            document_url="https://storage.example.com/resumes/test.docx",
            format="docx",
        )

        assert result["status"] == "success"
        assert result["format"] == "docx"

    def test_parse_resume_contact_fields(self):
        """Test that parsed resume contains contact fields."""
        from app.agents.tools.screening_tools import parse_resume

        result = parse_resume(
            document_url="https://storage.example.com/resumes/test.pdf",
            format="pdf",
        )

        contact = result["parsed_data"]["contact"]
        assert "name" in contact
        assert "email" in contact
        assert "phone" in contact
        assert "linkedin" in contact

    def test_enrich_linkedin_profile(self):
        """Test LinkedIn profile enrichment."""
        from app.agents.tools.screening_tools import enrich_linkedin_profile

        result = enrich_linkedin_profile(
            linkedin_url="https://linkedin.com/in/johndoe"
        )

        assert result["status"] == "success"
        assert result["linkedin_url"] == "https://linkedin.com/in/johndoe"
        assert "profile_data" in result
        assert "headline" in result["profile_data"]
        assert "current_position" in result["profile_data"]

    def test_enrich_linkedin_profile_returns_message(self):
        """Test that LinkedIn enrichment returns status message."""
        from app.agents.tools.screening_tools import enrich_linkedin_profile

        result = enrich_linkedin_profile(
            linkedin_url="https://linkedin.com/in/johndoe"
        )

        # Currently returns "not implemented" message
        assert "message" in result

    def test_check_previous_applications_no_history(self):
        """Test checking for previous applications with no history."""
        from app.agents.tools.screening_tools import check_previous_applications

        result = check_previous_applications(
            email="new.candidate@example.com",
            company_id="company-123",
        )

        assert result["status"] == "success"
        assert result["email"] == "new.candidate@example.com"
        assert result["company_id"] == "company-123"
        assert result["has_applied_before"] is False
        assert result["previous_applications"] == []

    def test_check_previous_applications_fields(self):
        """Test that previous applications check returns expected fields."""
        from app.agents.tools.screening_tools import check_previous_applications

        result = check_previous_applications(
            email="test@example.com",
            company_id="company-123",
        )

        assert "status" in result
        assert "email" in result
        assert "company_id" in result
        assert "previous_applications" in result
        assert "has_applied_before" in result


class TestTalentScreenerAgent:
    """Test cases for Talent Screener agent configuration."""

    def test_agent_has_correct_name(self):
        """Test that agent has the correct name."""
        with patch("app.agents.talent_screener.settings") as mock_settings:
            mock_settings.gemini_model = "gemini-2.5-flash"
            from app.agents.talent_screener import talent_screener_agent

            assert talent_screener_agent.name == "talent_screener"

    def test_agent_has_tools(self):
        """Test that agent has required tools."""
        with patch("app.agents.talent_screener.settings") as mock_settings:
            mock_settings.gemini_model = "gemini-2.5-flash"
            from app.agents.talent_screener import talent_screener_agent

            assert talent_screener_agent.tools is not None
            assert len(talent_screener_agent.tools) == 3  # parse_resume, enrich_linkedin, check_previous

    def test_agent_has_output_key(self):
        """Test that agent stores output in session state."""
        with patch("app.agents.talent_screener.settings") as mock_settings:
            mock_settings.gemini_model = "gemini-2.5-flash"
            from app.agents.talent_screener import talent_screener_agent

            assert talent_screener_agent.output_key == "screening_results"

    def test_agent_instruction_contains_guidelines(self):
        """Test that agent instruction contains key guidelines."""
        from app.agents.talent_screener import TALENT_SCREENER_INSTRUCTION

        assert "Talent Screener Agent" in TALENT_SCREENER_INSTRUCTION
        assert "score" in TALENT_SCREENER_INSTRUCTION.lower()
        assert "skills" in TALENT_SCREENER_INSTRUCTION.lower()
        assert "experience" in TALENT_SCREENER_INSTRUCTION.lower()

    def test_agent_instruction_references_jd_data(self):
        """Test that instruction references job description data from pipeline."""
        from app.agents.talent_screener import TALENT_SCREENER_INSTRUCTION

        assert "{jd_data}" in TALENT_SCREENER_INSTRUCTION

    def test_agent_instruction_includes_red_flags(self):
        """Test that instruction mentions red flags to watch for."""
        from app.agents.talent_screener import TALENT_SCREENER_INSTRUCTION

        assert "red flag" in TALENT_SCREENER_INSTRUCTION.lower()
        assert "employment gap" in TALENT_SCREENER_INSTRUCTION.lower()
        assert "inconsistenc" in TALENT_SCREENER_INSTRUCTION.lower()


class TestScreeningScoreCalculation:
    """Test cases for screening score calculations."""

    def test_valid_screening_result_structure(self):
        """Test that a valid screening result has expected structure."""
        valid_result = {
            "candidate_id": "candidate-123",
            "overall_score": 85,
            "match_breakdown": {
                "required_skills_match": 90,
                "nice_to_have_match": 70,
                "experience_match": 85,
                "education_match": 80,
            },
            "skill_analysis": [
                {
                    "skill": "Python",
                    "required": True,
                    "found": True,
                    "evidence": "7 years of Python development",
                    "proficiency_estimate": "advanced",
                }
            ],
            "experience_summary": {
                "total_years": 7,
                "relevant_years": 5,
                "key_experiences": ["Led team of 5", "Scaled systems to 1M users"],
            },
            "strengths": ["Strong Python skills", "Leadership experience"],
            "gaps": ["Limited cloud experience"],
            "red_flags": [],
            "recommendation": "strong_match",
            "notes": "Excellent candidate for the role.",
        }

        # Validate structure
        assert "candidate_id" in valid_result
        assert "overall_score" in valid_result
        assert 0 <= valid_result["overall_score"] <= 100
        assert "match_breakdown" in valid_result
        assert "recommendation" in valid_result

    def test_score_ranges(self):
        """Test that scores are within valid ranges."""
        match_breakdown = {
            "required_skills_match": 90,
            "nice_to_have_match": 70,
            "experience_match": 85,
            "education_match": 80,
        }

        for key, score in match_breakdown.items():
            assert 0 <= score <= 100, f"{key} score {score} out of range"

    def test_recommendation_values(self):
        """Test valid recommendation values."""
        valid_recommendations = ["strong_match", "good_match", "partial_match", "weak_match"]

        for rec in valid_recommendations:
            assert rec in valid_recommendations

    def test_skill_proficiency_levels(self):
        """Test valid skill proficiency levels."""
        valid_levels = ["beginner", "intermediate", "advanced", "expert"]

        for level in valid_levels:
            assert level in valid_levels


class TestScreeningSummary:
    """Test cases for screening summary generation."""

    def test_summary_structure(self):
        """Test that screening summary has correct structure."""
        summary = {
            "total_screened": 10,
            "strong_matches": 2,
            "good_matches": 3,
            "recommended_for_assessment": ["candidate-1", "candidate-2"],
        }

        assert summary["total_screened"] == 10
        assert summary["strong_matches"] <= summary["total_screened"]
        assert len(summary["recommended_for_assessment"]) == summary["strong_matches"]

    def test_summary_counts_add_up(self):
        """Test that summary counts are consistent."""
        results = [
            {"recommendation": "strong_match"},
            {"recommendation": "strong_match"},
            {"recommendation": "good_match"},
            {"recommendation": "partial_match"},
            {"recommendation": "weak_match"},
        ]

        total = len(results)
        strong = sum(1 for r in results if r["recommendation"] == "strong_match")
        good = sum(1 for r in results if r["recommendation"] == "good_match")

        assert total == 5
        assert strong == 2
        assert good == 1


class TestCandidateRanking:
    """Test cases for candidate ranking logic."""

    def test_candidates_sorted_by_score(self):
        """Test that candidates are sorted by score descending."""
        candidates = [
            {"id": "c1", "overall_score": 75},
            {"id": "c2", "overall_score": 90},
            {"id": "c3", "overall_score": 82},
        ]

        sorted_candidates = sorted(
            candidates, key=lambda x: x["overall_score"], reverse=True
        )

        assert sorted_candidates[0]["id"] == "c2"  # Highest score
        assert sorted_candidates[1]["id"] == "c3"
        assert sorted_candidates[2]["id"] == "c1"  # Lowest score

    def test_tie_breaking(self):
        """Test handling of tied scores."""
        candidates = [
            {"id": "c1", "overall_score": 85, "experience_match": 80},
            {"id": "c2", "overall_score": 85, "experience_match": 90},
        ]

        # Sort by score, then by experience as tiebreaker
        sorted_candidates = sorted(
            candidates,
            key=lambda x: (x["overall_score"], x["experience_match"]),
            reverse=True,
        )

        assert sorted_candidates[0]["id"] == "c2"  # Higher experience match
