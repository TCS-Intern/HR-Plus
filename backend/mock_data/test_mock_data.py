#!/usr/bin/env python3
"""
End-to-end test for mock data without database.
Tests data loading, document parsing simulation, and pipeline flow.

Usage:
    cd backend
    uv run python -m mock_data.test_mock_data
"""

import json
import re
from pathlib import Path
from typing import Any

# Test results
PASSED = 0
FAILED = 0


def test(name: str, condition: bool, message: str = ""):
    """Simple test assertion."""
    global PASSED, FAILED
    if condition:
        print(f"  ✓ {name}")
        PASSED += 1
    else:
        print(f"  ✗ {name}: {message}")
        FAILED += 1


def test_json_loading():
    """Test that all JSON files load correctly."""
    print("\n=== Testing JSON Data Loading ===")

    from mock_data import load_all_mock_data

    data = load_all_mock_data()

    test("Jobs loaded", len(data["jobs"]) == 4, f"Expected 4, got {len(data['jobs'])}")
    test("Candidates loaded", len(data["candidates"]) == 8, f"Expected 8, got {len(data['candidates'])}")
    test("Applications loaded", len(data["applications"]) == 9, f"Expected 9, got {len(data['applications'])}")
    test("Assessments loaded", len(data["assessments"]) == 4, f"Expected 4, got {len(data['assessments'])}")
    test("Offers loaded", len(data["offers"]) == 3, f"Expected 3, got {len(data['offers'])}")
    test("Phone screens loaded", len(data["phone_screens"]) == 3, f"Expected 3, got {len(data['phone_screens'])}")

    return data


def test_data_integrity(data: dict):
    """Test that mock data has proper relationships."""
    print("\n=== Testing Data Integrity ===")

    # Build ID sets
    job_ids = {j["id"] for j in data["jobs"]}
    candidate_ids = {c["id"] for c in data["candidates"]}
    application_ids = {a["id"] for a in data["applications"]}

    # Test applications reference valid jobs and candidates
    for app in data["applications"]:
        test(
            f"App {app['id']} -> valid job",
            app["job_id"] in job_ids,
            f"Job {app['job_id']} not found",
        )
        test(
            f"App {app['id']} -> valid candidate",
            app["candidate_id"] in candidate_ids,
            f"Candidate {app['candidate_id']} not found",
        )

    # Test assessments reference valid applications
    for assess in data["assessments"]:
        test(
            f"Assessment {assess['id']} -> valid application",
            assess["application_id"] in application_ids,
            f"Application {assess['application_id']} not found",
        )

    # Test offers reference valid applications
    for offer in data["offers"]:
        test(
            f"Offer {offer['id']} -> valid application",
            offer["application_id"] in application_ids,
            f"Application {offer['application_id']} not found",
        )


def test_pipeline_stages(data: dict):
    """Test that we have data at each pipeline stage."""
    print("\n=== Testing Pipeline Stage Coverage ===")

    statuses = [a["status"] for a in data["applications"]]

    test("Has 'new' or 'screening' apps", any(s in ["new", "screening"] for s in statuses))
    test("Has 'shortlisted' apps", "shortlisted" in statuses)
    test("Has 'assessment' apps", "assessment" in statuses)
    test("Has 'offer' apps", "offer" in statuses)
    test("Has 'hired' apps", "hired" in statuses)
    test("Has 'rejected' apps", "rejected" in statuses)

    # Test assessment statuses
    assess_statuses = [a["status"] for a in data["assessments"]]
    test("Has 'scheduled' assessments", "scheduled" in assess_statuses)
    test("Has 'analyzed' assessments", "analyzed" in assess_statuses)

    # Test offer statuses
    offer_statuses = [o["status"] for o in data["offers"]]
    test("Has 'draft' offers", "draft" in offer_statuses)
    test("Has 'approved' offers", "approved" in offer_statuses)
    test("Has 'accepted' offers", "accepted" in offer_statuses)


def test_document_loading():
    """Test document loading utilities."""
    print("\n=== Testing Document Loading ===")

    from mock_data import documents

    resumes = documents.get_resumes()
    test("Resumes found", len(resumes) >= 5, f"Found {len(resumes)}")

    jds = documents.get_job_descriptions()
    test("Job descriptions found", len(jds) >= 3, f"Found {len(jds)}")

    cover_letters = documents.get_cover_letters()
    test("Cover letters found", len(cover_letters) >= 2, f"Found {len(cover_letters)}")

    # Test reading a document
    resume = documents.get_resume("sarah_chen", "md")
    content = documents.read_document(resume)
    test("Resume readable", len(content) > 1000, f"Content length: {len(content)}")
    test("Resume has name", "Sarah Chen" in content)
    test("Resume has sections", "## Experience" in content)


def test_resume_parsing_simulation():
    """Simulate resume parsing to verify document structure."""
    print("\n=== Testing Resume Parsing Simulation ===")

    from mock_data import documents

    for resume_key, metadata in documents.DOCUMENT_METADATA.items():
        name = resume_key.replace("_resume", "")
        resume_path = documents.get_resume(name, "md")
        content = documents.read_document(resume_path)

        # Verify metadata matches document content
        test(
            f"{name}: Name in document",
            metadata["candidate_name"] in content,
            f"Expected '{metadata['candidate_name']}'",
        )

        # Check for at least some skills
        skills_found = sum(1 for skill in metadata["skills"] if skill in content)
        test(
            f"{name}: Skills mentioned",
            skills_found >= len(metadata["skills"]) // 2,
            f"Found {skills_found}/{len(metadata['skills'])} skills",
        )


def test_job_description_parsing():
    """Test that job descriptions have expected structure."""
    print("\n=== Testing Job Description Structure ===")

    from mock_data import documents

    for jd_path in documents.get_job_descriptions():
        content = documents.read_document(jd_path)
        name = jd_path.stem

        test(f"{name}: Has title", content.startswith("#"))
        test(f"{name}: Has requirements section", "Required" in content or "What We're Looking For" in content)
        test(f"{name}: Has compensation", "Salary" in content or "Compensation" in content)
        test(f"{name}: Has responsibilities", "What You'll Do" in content or "Responsibilities" in content)


def test_assessment_questions():
    """Test that assessments have proper question structure."""
    print("\n=== Testing Assessment Question Structure ===")

    from mock_data import load_mock_file

    assessments = load_mock_file("assessments.json")

    for assess in assessments:
        if assess.get("questions"):
            questions = assess["questions"]
            test(
                f"Assessment {assess['id']}: Has questions",
                len(questions) >= 3,
                f"Found {len(questions)}",
            )

            for q in questions:
                test(
                    f"  Question has required fields",
                    all(k in q for k in ["id", "type", "question", "rubric"]),
                    f"Missing fields in {q.get('id', 'unknown')}",
                )


def test_email_preview_data():
    """Test that we have data needed for email previews."""
    print("\n=== Testing Email Preview Data ===")

    from mock_data import load_all_mock_data

    data = load_all_mock_data()

    # Find an application with assessment for email preview
    apps_with_assessment = [
        a for a in data["applications"]
        if a["status"] in ["assessment", "offer", "hired"]
    ]
    test("Apps ready for assessment emails", len(apps_with_assessment) >= 2)

    # Find an offer for offer letter email
    sent_offers = [o for o in data["offers"] if o["status"] in ["approved", "sent", "accepted"]]
    test("Offers ready for email", len(sent_offers) >= 1)

    # Check candidate has email
    for candidate in data["candidates"]:
        test(
            f"Candidate {candidate['first_name']} has email",
            bool(candidate.get("email")),
        )


def test_full_pipeline_flow():
    """Simulate a complete hiring pipeline flow."""
    print("\n=== Testing Full Pipeline Flow Simulation ===")

    from mock_data import load_all_mock_data, documents

    data = load_all_mock_data()

    # Find Sarah Chen's journey through the pipeline
    sarah = next((c for c in data["candidates"] if c["first_name"] == "Sarah"), None)
    test("Found Sarah Chen", sarah is not None)

    if sarah:
        # Find her application
        app = next((a for a in data["applications"] if a["candidate_id"] == sarah["id"]), None)
        test("Sarah has application", app is not None)

        if app:
            job = next((j for j in data["jobs"] if j["id"] == app["job_id"]), None)
            test("Application linked to job", job is not None)

            # Check screening data
            test("Has screening score", app.get("screening_score") is not None)
            test("Has recommendation", app.get("screening_recommendation") is not None)

            # Find assessment
            assess = next(
                (a for a in data["assessments"] if a["application_id"] == app["id"]),
                None,
            )
            if assess:
                test("Assessment found", True)
                test("Assessment has questions", len(assess.get("questions", [])) > 0)
                test("Assessment analyzed", assess.get("status") == "analyzed")

            # Find offer
            offer = next(
                (o for o in data["offers"] if o["application_id"] == app["id"]),
                None,
            )
            if offer:
                test("Offer found", True)
                test("Offer has salary", offer.get("base_salary", 0) > 0)

    # Verify resume document exists for Sarah
    resume = documents.get_resume("sarah_chen", "md")
    test("Sarah's resume document exists", resume.exists())


def main():
    """Run all tests."""
    global PASSED, FAILED

    print("=" * 60)
    print("  Mock Data End-to-End Test Suite")
    print("=" * 60)

    # Run all tests
    data = test_json_loading()
    test_data_integrity(data)
    test_pipeline_stages(data)
    test_document_loading()
    test_resume_parsing_simulation()
    test_job_description_parsing()
    test_assessment_questions()
    test_email_preview_data()
    test_full_pipeline_flow()

    # Summary
    print("\n" + "=" * 60)
    total = PASSED + FAILED
    print(f"  Results: {PASSED}/{total} tests passed")
    if FAILED > 0:
        print(f"  ⚠️  {FAILED} tests failed")
    else:
        print("  ✅ All tests passed!")
    print("=" * 60)

    return FAILED == 0


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
