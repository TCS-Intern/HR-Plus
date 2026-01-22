"""Tools for Talent Assessor Agent.

These tools provide video analysis capabilities using Google Gemini Vision API.
They are used by the Talent Assessor agent to analyze candidate video assessments.
"""

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def analyze_video_segment(
    video_url: str, start_time: str, end_time: str, analysis_type: str
) -> dict[str, Any]:
    """Analyze a specific segment of video for content and behavior.

    This tool uses Gemini Vision to analyze a video segment, extracting
    behavioral indicators, communication quality, and content assessment.

    Args:
        video_url: URL/path to the video in storage
        start_time: Start time in MM:SS format
        end_time: End time in MM:SS format
        analysis_type: Type of analysis (content, behavior, communication)

    Returns:
        Dictionary with segment analysis including:
        - status: "success" or "error"
        - video_url: The input video URL
        - segment: {"start": str, "end": str}
        - analysis_type: The requested analysis type
        - analysis: {
            "content": str,  # What the candidate said
            "observations": [str],  # Behavioral observations
            "scores": {
                "confidence": int,  # 1-10
                "communication": int,
                "body_language": int,
                "eye_contact": int
            }
        }
    """
    try:
        # Import here to avoid circular imports
        from app.services.video_analyzer import video_analyzer

        # Run async function in sync context
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If already in async context, create a new task
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    video_analyzer.analyze_video_segment(
                        video_url, start_time, end_time, analysis_type
                    ),
                )
                result = future.result()
        else:
            result = loop.run_until_complete(
                video_analyzer.analyze_video_segment(video_url, start_time, end_time, analysis_type)
            )

        # Convert dataclass to dict
        return {
            "status": result.status,
            "video_url": result.video_url,
            "segment": result.segment,
            "analysis_type": result.analysis_type,
            "analysis": result.analysis,
        }

    except Exception as e:
        logger.error(f"analyze_video_segment failed: {e}")
        return {
            "status": "error",
            "video_url": video_url,
            "segment": {"start": start_time, "end": end_time},
            "analysis_type": analysis_type,
            "analysis": {
                "content": "",
                "observations": [f"Analysis failed: {str(e)}"],
                "scores": {
                    "confidence": 0,
                    "communication": 0,
                    "body_language": 0,
                    "eye_contact": 0,
                },
            },
        }


def transcribe_audio(video_url: str) -> dict[str, Any]:
    """Get text transcription of video audio using Gemini.

    This tool uses Gemini's audio understanding capabilities to transcribe
    speech from a video recording.

    Args:
        video_url: URL/path to the video in storage

    Returns:
        Dictionary with transcription data:
        - status: "success" or "error"
        - video_url: The input video URL
        - transcription: {
            "full_text": str,  # Complete transcription
            "segments": [  # Timestamped segments
                {"start": "MM:SS", "end": "MM:SS", "text": "..."}
            ],
            "confidence": float  # 0.0-1.0
        }
    """
    try:
        # Import here to avoid circular imports
        from app.services.video_analyzer import video_analyzer

        # Run async function in sync context
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                # First download the video
                future = executor.submit(asyncio.run, video_analyzer.download_video(video_url))
                video_bytes = future.result()

                # Then transcribe
                future = executor.submit(asyncio.run, video_analyzer.transcribe_audio(video_bytes))
                result = future.result()
        else:
            video_bytes = loop.run_until_complete(video_analyzer.download_video(video_url))
            result = loop.run_until_complete(video_analyzer.transcribe_audio(video_bytes))

        # Convert dataclass to dict and add video_url
        return {
            "status": result.status,
            "video_url": video_url,
            "transcription": result.transcription,
        }

    except Exception as e:
        logger.error(f"transcribe_audio failed: {e}")
        return {
            "status": "error",
            "video_url": video_url,
            "transcription": {
                "full_text": "",
                "segments": [],
                "confidence": 0.0,
            },
        }


def get_industry_benchmarks(job_title: str, experience_level: str) -> dict[str, Any]:
    """Get typical response quality benchmarks for role.

    This tool provides industry benchmarks for assessment evaluation,
    helping calibrate scores against expected performance levels.

    Args:
        job_title: The job title to get benchmarks for
        experience_level: junior, mid, senior, or lead

    Returns:
        Dictionary with benchmark data for different assessment areas
    """
    # Base benchmarks
    base_benchmarks = {
        "technical_depth": {
            "excellent": 9,
            "good": 7,
            "adequate": 5,
            "poor": 3,
        },
        "communication": {
            "excellent": 9,
            "good": 7,
            "adequate": 5,
            "poor": 3,
        },
        "problem_solving": {
            "excellent": 9,
            "good": 7,
            "adequate": 5,
            "poor": 3,
        },
        "behavioral": {
            "excellent": 9,
            "good": 7,
            "adequate": 5,
            "poor": 3,
        },
    }

    # Adjust expectations based on experience level
    level_adjustments = {
        "junior": {
            "technical_depth": {"excellent": 7, "good": 5, "adequate": 3, "poor": 1},
            "problem_solving": {"excellent": 7, "good": 5, "adequate": 3, "poor": 1},
        },
        "mid": {
            "technical_depth": {"excellent": 8, "good": 6, "adequate": 4, "poor": 2},
            "problem_solving": {"excellent": 8, "good": 6, "adequate": 4, "poor": 2},
        },
        "senior": {
            "technical_depth": {"excellent": 9, "good": 7, "adequate": 5, "poor": 3},
            "problem_solving": {"excellent": 9, "good": 7, "adequate": 5, "poor": 3},
            "communication": {"excellent": 9, "good": 8, "adequate": 6, "poor": 4},
        },
        "lead": {
            "technical_depth": {"excellent": 10, "good": 8, "adequate": 6, "poor": 4},
            "problem_solving": {"excellent": 10, "good": 8, "adequate": 6, "poor": 4},
            "communication": {"excellent": 10, "good": 9, "adequate": 7, "poor": 5},
            "behavioral": {"excellent": 10, "good": 8, "adequate": 6, "poor": 4},
        },
    }

    # Apply adjustments
    level = experience_level.lower()
    if level in level_adjustments:
        for category, thresholds in level_adjustments[level].items():
            base_benchmarks[category] = thresholds

    # Role-specific adjustments
    job_title_lower = job_title.lower()

    # Technical roles need higher technical benchmarks
    if any(
        term in job_title_lower
        for term in ["engineer", "developer", "architect", "scientist", "analyst"]
    ):
        base_benchmarks["technical_depth"]["good"] = min(
            base_benchmarks["technical_depth"]["good"] + 1, 10
        )

    # Management/leadership roles need higher communication benchmarks
    if any(
        term in job_title_lower for term in ["manager", "director", "lead", "head", "vp", "chief"]
    ):
        base_benchmarks["communication"]["good"] = min(
            base_benchmarks["communication"]["good"] + 1, 10
        )
        base_benchmarks["behavioral"]["good"] = min(base_benchmarks["behavioral"]["good"] + 1, 10)

    # Customer-facing roles
    if any(
        term in job_title_lower for term in ["sales", "support", "success", "account", "consultant"]
    ):
        base_benchmarks["communication"]["good"] = min(
            base_benchmarks["communication"]["good"] + 1, 10
        )

    return {
        "status": "success",
        "job_title": job_title,
        "experience_level": experience_level,
        "benchmarks": base_benchmarks,
        "notes": [
            f"Benchmarks calibrated for {experience_level} level {job_title}",
            "Scores should be compared against 'good' threshold for pass/fail",
            "Consider cultural context when evaluating communication",
        ],
    }


async def analyze_full_video(
    video_url: str,
    questions: list[dict[str, Any]] | None = None,
    job_context: str = "",
) -> dict[str, Any]:
    """Analyze a complete video assessment with Gemini Vision.

    This is an async helper function that performs comprehensive video analysis.
    It's used by the API layer for full assessment analysis.

    Args:
        video_url: URL/path to the video in storage
        questions: List of assessment questions asked
        job_context: Context about the job being assessed for

    Returns:
        Comprehensive analysis including:
        - overall_score: 0-100
        - recommendation: STRONG_YES, YES, MAYBE, NO
        - confidence_level: high, medium, low
        - response_analysis: Per-question analysis
        - communication_assessment: Communication quality metrics
        - behavioral_assessment: Behavioral indicators
        - summary: Overall summary with strengths/concerns
    """
    try:
        from app.services.video_analyzer import video_analyzer

        # Download the video
        video_bytes = await video_analyzer.download_video(video_url)

        # Run comprehensive analysis
        result = await video_analyzer.analyze_video_with_gemini(
            video_bytes=video_bytes,
            questions=questions,
            job_context=job_context,
        )

        return result

    except Exception as e:
        logger.error(f"Full video analysis failed: {e}")
        return {
            "overall_score": 0,
            "recommendation": "MAYBE",
            "confidence_level": "low",
            "response_analysis": [],
            "communication_assessment": {},
            "behavioral_assessment": {"enabled": False},
            "summary": {
                "top_strengths": [],
                "areas_of_concern": [f"Analysis failed: {str(e)}"],
                "hiring_recommendation": "Manual review required due to analysis error",
                "suggested_follow_up_questions": [],
            },
        }
