"""
E2E Integration Test: Sourcing → Phone Screening → Interview Prep

This test uses REAL API calls (Apollo, Gemini) - no mocks.
Requires actual API keys in .env to run.

Pipeline stages:
1. Source candidates via Apollo search
2. Score a candidate using Gemini
3. Convert sourced candidate to formal application
4. Schedule a web-based phone screen
5. Generate assessment questions for human interviewer prep
"""

import os
import uuid

import pytest

# Check for required API keys
HAS_APOLLO_KEY = bool(os.environ.get("APOLLO_API_KEY"))
HAS_GOOGLE_KEY = bool(os.environ.get("GOOGLE_API_KEY"))
HAS_SUPABASE = bool(
    os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY")
)

SKIP_REASON_APOLLO = "APOLLO_API_KEY not set"
SKIP_REASON_GOOGLE = "GOOGLE_API_KEY not set"
SKIP_REASON_SUPABASE = "SUPABASE_URL/SUPABASE_SERVICE_KEY not set"
SKIP_REASON_ALL = "Requires APOLLO_API_KEY, GOOGLE_API_KEY, and SUPABASE credentials"


@pytest.mark.integration
class TestSourcingToInterviewE2E:
    """
    End-to-end test: sourcing candidates through to interview preparation.

    Tests run sequentially - each stage depends on the previous one.
    Uses real API calls to Apollo, Gemini, and Supabase.
    """

    # Shared state across tests in this class
    sourced_candidates: list = []
    selected_candidate: dict = {}
    score_result: dict = {}
    application: dict = {}
    phone_screen: dict = {}
    assessment_questions: dict = {}

    # ====================================
    # Stage 1: Source Candidates via Apollo
    # ====================================

    @pytest.mark.skipif(not HAS_APOLLO_KEY, reason=SKIP_REASON_APOLLO)
    async def test_01_source_candidates_via_apollo(self):
        """Search for Software Engineer candidates using Apollo API."""
        from app.services.apollo import apollo

        result = await apollo.search_people(
            job_titles=["Software Engineer"],
            locations=["San Francisco"],
            per_page=5,
        )

        assert result.get("status") != "error", f"Apollo search failed: {result.get('message')}"

        people = result.get("people", [])
        assert len(people) > 0, "Apollo returned no results"

        # Store for next stages
        TestSourcingToInterviewE2E.sourced_candidates = people

        # Verify candidate data structure
        first = people[0]
        assert first.get("first_name") or first.get("name"), "Candidate missing name"

        print(f"Sourced {len(people)} candidates from Apollo")
        for p in people[:3]:
            name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            title = p.get("title", "N/A")
            print(f"  - {name}: {title}")

    # ====================================
    # Stage 2: Score Candidate with Gemini
    # ====================================

    @pytest.mark.skipif(
        not (HAS_APOLLO_KEY and HAS_GOOGLE_KEY),
        reason="Requires both APOLLO_API_KEY and GOOGLE_API_KEY",
    )
    async def test_02_score_candidate_with_gemini(self):
        """Use Gemini to score a sourced candidate against a job description."""
        from app.agents.coordinator import agent_coordinator

        candidates = TestSourcingToInterviewE2E.sourced_candidates
        if not candidates:
            pytest.skip("No sourced candidates from stage 1")

        selected = candidates[0]
        TestSourcingToInterviewE2E.selected_candidate = selected

        # Build candidate data in the format the screener expects
        candidate_data = {
            "id": str(uuid.uuid4()),
            "first_name": selected.get("first_name", ""),
            "last_name": selected.get("last_name", ""),
            "email": selected.get("email", "unknown@example.com"),
            "resume_parsed": {
                "summary": f"{selected.get('title', '')} at {selected.get('organization_name', '')}",
                "skills": selected.get("departments", []),
                "experience": [
                    {
                        "company": selected.get("organization_name", ""),
                        "title": selected.get("title", ""),
                    }
                ],
                "education": [],
            },
        }

        # Job description to score against
        job_data = {
            "title": "Senior Software Engineer",
            "department": "Engineering",
            "description": "Build scalable backend systems using Python and cloud services.",
            "skills_matrix": {
                "required": [
                    {"skill": "Python", "proficiency": "advanced", "weight": 0.9},
                    {"skill": "SQL", "proficiency": "intermediate", "weight": 0.7},
                    {"skill": "Cloud (AWS/GCP)", "proficiency": "intermediate", "weight": 0.6},
                ],
                "nice_to_have": [
                    {"skill": "Docker", "proficiency": "intermediate", "weight": 0.4},
                ],
            },
            "evaluation_criteria": [
                {
                    "criterion": "Technical Skills",
                    "weight": 40,
                    "description": "Coding ability and system design",
                    "assessment_method": "technical",
                },
            ],
        }

        result = await agent_coordinator.run_talent_screener(
            job_data=job_data,
            candidates=[candidate_data],
        )

        TestSourcingToInterviewE2E.score_result = result

        # The result should contain scoring data
        assert result, "Screener returned empty result"

        # Score might be at top level or nested
        score = result.get("overall_score") or result.get("screening_results", [{}])[0].get(
            "overall_score"
        )
        print(f"Candidate scored: {score}")
        print(f"Recommendation: {result.get('recommendation', 'N/A')}")
        if result.get("strengths"):
            print(f"Strengths: {result['strengths'][:2]}")

    # ====================================
    # Stage 3: Convert to Application
    # ====================================

    @pytest.mark.skipif(not HAS_SUPABASE, reason=SKIP_REASON_SUPABASE)
    async def test_03_convert_to_application(self):
        """Convert a sourced candidate to a formal application in Supabase."""
        from app.services.supabase import db

        candidate = TestSourcingToInterviewE2E.selected_candidate
        if not candidate:
            pytest.skip("No selected candidate from stage 2")

        # Create a job first
        job_data = {
            "title": "Senior Software Engineer",
            "department": "Engineering",
            "location": "San Francisco, CA",
            "job_type": "full-time",
            "status": "active",
            "description": "E2E test job",
            "skills_matrix": {
                "required": [{"skill": "Python", "proficiency": "advanced", "weight": 0.9}]
            },
        }

        job = await db.create_job(job_data)
        assert job and job.get("id"), "Failed to create job"

        # Create candidate record
        candidate_record = await db.upsert_candidate(
            {
                "email": candidate.get("email", f"test-{uuid.uuid4().hex[:8]}@e2e-test.com"),
                "first_name": candidate.get("first_name", "E2E"),
                "last_name": candidate.get("last_name", "Test"),
                "source": "sourced",
            }
        )
        assert candidate_record and candidate_record.get("id"), "Failed to create candidate"

        # Create application
        score = TestSourcingToInterviewE2E.score_result.get("overall_score", 75)
        application_data = {
            "job_id": job["id"],
            "candidate_id": candidate_record["id"],
            "status": "new",
            "screening_score": score,
            "source": "sourced",
        }

        application = await db.create_application(application_data)
        assert application and application.get("id"), "Failed to create application"
        TestSourcingToInterviewE2E.application = application

        print(f"Created application {application['id']}")
        print(f"  Job: {job['title']}")
        print(f"  Candidate: {candidate_record.get('first_name')} {candidate_record.get('last_name')}")
        print(f"  Score: {score}")

        # Cleanup: store IDs for potential teardown
        TestSourcingToInterviewE2E._cleanup_ids = {
            "job_id": job["id"],
            "candidate_id": candidate_record["id"],
            "application_id": application["id"],
        }

    # ====================================
    # Stage 4: Schedule Web Phone Screen
    # ====================================

    @pytest.mark.skipif(not HAS_SUPABASE, reason=SKIP_REASON_SUPABASE)
    async def test_04_schedule_phone_screen(self):
        """Create a phone screen record for the candidate (ElevenLabs web mode)."""
        from app.services.supabase import db

        application = TestSourcingToInterviewE2E.application
        if not application or not application.get("id"):
            pytest.skip("No application from stage 3")

        phone_screen_data = {
            "application_id": application["id"],
            "mode": "elevenlabs_web",
            "status": "pending",
            "company_name": "Telentic",
            "job_title": "Senior Software Engineer",
            "candidate_name": f"{TestSourcingToInterviewE2E.selected_candidate.get('first_name', 'E2E')} {TestSourcingToInterviewE2E.selected_candidate.get('last_name', 'Test')}",
        }

        phone_screen = await db.create_phone_screen(phone_screen_data)
        assert phone_screen, "Failed to create phone screen"
        TestSourcingToInterviewE2E.phone_screen = phone_screen

        print(f"Phone screen created: {phone_screen.get('id', 'N/A')}")
        print(f"  Mode: elevenlabs_web")
        print(f"  Status: pending")

    # ====================================
    # Stage 5: Generate Assessment Questions
    # ====================================

    @pytest.mark.skipif(
        not (HAS_GOOGLE_KEY and HAS_SUPABASE),
        reason="Requires GOOGLE_API_KEY and SUPABASE credentials",
    )
    async def test_05_generate_assessment_questions(self):
        """Use Gemini to generate technical interview questions for human interviewer."""
        from app.agents.coordinator import agent_coordinator

        application = TestSourcingToInterviewE2E.application
        if not application or not application.get("id"):
            pytest.skip("No application from stage 3")

        result = await agent_coordinator.run_assessor_questions(
            job_id=application.get("job_id", "test-job"),
            candidate_id=application.get("candidate_id", "test-candidate"),
        )

        TestSourcingToInterviewE2E.assessment_questions = result

        assert result, "Assessor returned empty result"

        questions = result.get("questions", [])
        if questions:
            print(f"Generated {len(questions)} assessment questions:")
            for i, q in enumerate(questions[:3], 1):
                q_text = q.get("question_text", q.get("question", "N/A"))
                q_type = q.get("question_type", q.get("type", "N/A"))
                print(f"  {i}. [{q_type}] {q_text[:80]}...")
        else:
            # Agent might return questions in a different format
            print(f"Assessment result keys: {list(result.keys())}")
            assert result.get("response") or result.get("questions"), (
                "No questions generated"
            )

        if result.get("instructions"):
            print(f"Preparation instructions: {result['instructions']}")

    # ====================================
    # Summary
    # ====================================

    @pytest.mark.skipif(
        not (HAS_APOLLO_KEY and HAS_GOOGLE_KEY),
        reason=SKIP_REASON_ALL,
    )
    async def test_06_pipeline_summary(self):
        """Print a summary of the full pipeline execution."""
        print("\n" + "=" * 60)
        print("E2E PIPELINE SUMMARY: Sourcing → Interview Prep")
        print("=" * 60)

        candidates = TestSourcingToInterviewE2E.sourced_candidates
        print(f"1. Sourced: {len(candidates)} candidates from Apollo")

        score = TestSourcingToInterviewE2E.score_result
        print(f"2. Scored: {score.get('overall_score', 'N/A')}/100")

        app = TestSourcingToInterviewE2E.application
        print(f"3. Application: {'Created' if app.get('id') else 'Skipped (no Supabase)'}")

        ps = TestSourcingToInterviewE2E.phone_screen
        print(f"4. Phone Screen: {'Scheduled' if ps else 'Skipped'}")

        questions = TestSourcingToInterviewE2E.assessment_questions
        q_count = len(questions.get("questions", []))
        print(f"5. Interview Questions: {q_count} generated")

        print("=" * 60)
        print("Pipeline completed successfully!")
