"""Video analysis service using Google Gemini Vision API.

This service provides functionality to:
- Download videos from Supabase storage
- Extract key frames from videos using ffmpeg
- Analyze video content with Gemini Vision
- Transcribe audio from videos
- Aggregate analysis into structured results
"""

import asyncio
import base64
import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from app.config import settings
from app.services.storage import StorageService, storage

logger = logging.getLogger(__name__)

# Initialize Gemini client
os.environ["GOOGLE_API_KEY"] = settings.google_api_key
client = genai.Client()


@dataclass
class FrameAnalysis:
    """Analysis result for a single frame."""

    timestamp: str
    body_language: str
    eye_contact: str
    confidence_level: int  # 1-10
    observations: list[str]


@dataclass
class VideoSegmentAnalysis:
    """Analysis result for a video segment."""

    status: str
    video_url: str
    segment: dict[str, str]
    analysis_type: str
    analysis: dict[str, Any]


@dataclass
class TranscriptionResult:
    """Result from audio transcription."""

    status: str
    video_url: str
    transcription: dict[str, Any]


class VideoAnalyzer:
    """Service for analyzing video content using Gemini Vision."""

    def __init__(self):
        """Initialize the video analyzer."""
        self.model = settings.gemini_model
        self.storage = storage

    async def download_video(self, video_path: str) -> bytes:
        """Download video from Supabase storage.

        Args:
            video_path: Path to video in Supabase storage (e.g., "assessments/uuid.webm")

        Returns:
            Video content as bytes
        """
        try:
            logger.info(f"Downloading video from: {video_path}")
            video_bytes = await self.storage.download_file(
                StorageService.BUCKET_VIDEOS, video_path
            )
            logger.info(f"Downloaded video: {len(video_bytes)} bytes")
            return video_bytes
        except Exception as e:
            logger.error(f"Failed to download video: {e}")
            raise

    def extract_key_frames(
        self,
        video_bytes: bytes,
        num_frames: int = 10,
        video_format: str = "webm",
    ) -> list[tuple[str, bytes]]:
        """Extract key frames from video using ffmpeg.

        Args:
            video_bytes: Video content as bytes
            num_frames: Number of frames to extract
            video_format: Format of the input video

        Returns:
            List of tuples (timestamp_str, frame_bytes)
        """
        frames = []

        with tempfile.TemporaryDirectory() as temp_dir:
            # Write video to temp file
            video_path = Path(temp_dir) / f"video.{video_format}"
            with open(video_path, "wb") as f:
                f.write(video_bytes)

            # Get video duration using ffprobe
            duration_cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ]

            try:
                result = subprocess.run(
                    duration_cmd, capture_output=True, text=True, check=True
                )
                duration = float(result.stdout.strip())
            except subprocess.CalledProcessError as e:
                logger.error(f"ffprobe failed: {e.stderr}")
                # Default to 60 seconds if we can't get duration
                duration = 60.0
            except ValueError:
                logger.warning("Could not parse video duration")
                duration = 60.0

            # Calculate timestamps for frame extraction
            interval = duration / (num_frames + 1)
            timestamps = [interval * (i + 1) for i in range(num_frames)]

            # Extract frames at each timestamp
            for i, ts in enumerate(timestamps):
                output_path = Path(temp_dir) / f"frame_{i:03d}.jpg"

                # Convert timestamp to MM:SS format for display
                minutes = int(ts // 60)
                seconds = int(ts % 60)
                timestamp_str = f"{minutes:02d}:{seconds:02d}"

                ffmpeg_cmd = [
                    "ffmpeg",
                    "-ss",
                    str(ts),
                    "-i",
                    str(video_path),
                    "-vframes",
                    "1",
                    "-q:v",
                    "2",  # High quality JPEG
                    "-y",  # Overwrite output
                    str(output_path),
                ]

                try:
                    subprocess.run(
                        ffmpeg_cmd,
                        capture_output=True,
                        check=True,
                        timeout=30,
                    )

                    if output_path.exists():
                        with open(output_path, "rb") as f:
                            frame_bytes = f.read()
                        frames.append((timestamp_str, frame_bytes))
                        logger.debug(f"Extracted frame at {timestamp_str}")
                except subprocess.CalledProcessError as e:
                    logger.warning(f"Failed to extract frame at {ts}s: {e.stderr}")
                except subprocess.TimeoutExpired:
                    logger.warning(f"Frame extraction timed out at {ts}s")

        logger.info(f"Extracted {len(frames)} frames from video")
        return frames

    async def analyze_frame(
        self,
        frame_bytes: bytes,
        timestamp: str,
        context: str = "",
    ) -> FrameAnalysis:
        """Analyze a single frame for behavioral indicators.

        Args:
            frame_bytes: JPEG frame as bytes
            timestamp: Timestamp of the frame (MM:SS format)
            context: Additional context about the assessment

        Returns:
            FrameAnalysis with behavioral observations
        """
        # Encode frame to base64
        frame_b64 = base64.standard_b64encode(frame_bytes).decode("utf-8")

        prompt = f"""Analyze this video frame from a job candidate's video assessment.

Timestamp: {timestamp}
Context: {context}

Evaluate the following aspects and provide your analysis:

1. Body Language: Describe the candidate's posture, hand gestures, and overall body positioning.
   Is it open and engaged, or closed off and defensive?

2. Eye Contact: Assess where the candidate appears to be looking.
   Are they maintaining appropriate eye contact with the camera, looking away frequently, or avoiding eye contact?

3. Confidence Level: Rate the candidate's apparent confidence from 1-10.
   Consider posture, facial expression, and overall demeanor.

4. Observations: List 2-4 specific observations about the candidate's non-verbal communication.

IMPORTANT GUIDELINES:
- Base assessments only on observable behaviors, not assumptions about identity
- Consider that cultural differences affect communication styles
- Do not make judgments based on appearance, accent, or physical characteristics
- Focus on professional communication indicators

Respond in this exact JSON format:
{{
    "body_language": "description of body language",
    "eye_contact": "description of eye contact behavior",
    "confidence_level": 7,
    "observations": ["observation 1", "observation 2"]
}}"""

        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model,
                contents=[
                    types.Content(
                        parts=[
                            types.Part(
                                inline_data=types.Blob(
                                    mime_type="image/jpeg",
                                    data=frame_b64,
                                )
                            ),
                            types.Part(text=prompt),
                        ]
                    )
                ],
            )

            # Parse response
            response_text = response.text
            if response_text:
                # Clean up response
                cleaned = response_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                import json

                data = json.loads(cleaned)
                return FrameAnalysis(
                    timestamp=timestamp,
                    body_language=data.get("body_language", ""),
                    eye_contact=data.get("eye_contact", ""),
                    confidence_level=data.get("confidence_level", 5),
                    observations=data.get("observations", []),
                )
        except Exception as e:
            logger.error(f"Frame analysis failed at {timestamp}: {e}")

        # Return default analysis if failed
        return FrameAnalysis(
            timestamp=timestamp,
            body_language="Unable to analyze",
            eye_contact="Unable to analyze",
            confidence_level=5,
            observations=["Analysis unavailable for this frame"],
        )

    async def analyze_video_with_gemini(
        self,
        video_bytes: bytes,
        questions: list[dict[str, Any]] | None = None,
        job_context: str = "",
    ) -> dict[str, Any]:
        """Analyze entire video using Gemini's native video understanding.

        This method uploads the video directly to Gemini for comprehensive analysis.

        Args:
            video_bytes: Video content as bytes
            questions: List of assessment questions asked
            job_context: Context about the job being assessed for

        Returns:
            Comprehensive video analysis
        """
        # Format questions for the prompt
        questions_text = ""
        if questions:
            questions_text = "Assessment Questions Asked:\n"
            for i, q in enumerate(questions, 1):
                q_text = q.get("question_text", q.get("text", ""))
                q_type = q.get("question_type", q.get("type", "general"))
                questions_text += f"{i}. [{q_type}] {q_text}\n"

        prompt = f"""Analyze this video assessment of a job candidate.

{job_context}

{questions_text}

Provide a comprehensive analysis including:

1. CONTENT ANALYSIS - For each response:
   - What did they actually say? (summarize key points)
   - Did they answer the question fully?
   - What specific examples or experiences did they share?
   - What topics did they cover vs miss?

2. COMMUNICATION ASSESSMENT:
   - Clarity: How clearly do they articulate their thoughts? (1-10)
   - Structure: Is their response well-organized?
   - Vocabulary: Basic, professional, or expert level?
   - Pace: Too slow, good, or too fast?
   - Filler words: Low, moderate, or high frequency?

3. BEHAVIORAL ASSESSMENT:
   - Confidence indicators (score 1-10 with specific observations)
   - Engagement indicators (score 1-10 with specific observations)
   - Body language notes
   - Any stress indicators observed
   - Positive professional signals

4. OVERALL ASSESSMENT:
   - Overall score (0-100)
   - Recommendation: STRONG_YES, YES, MAYBE, or NO
   - Confidence in your assessment: high, medium, or low
   - Top 3 strengths
   - Top 3 areas of concern
   - Suggested follow-up questions for a live interview

IMPORTANT:
- Base all assessments on observable behaviors and stated content
- Note specific timestamps (MM:SS) for notable moments
- Consider cultural differences in communication styles
- Be objective and fair

Respond in this exact JSON format:
{{
    "overall_score": 75,
    "recommendation": "YES",
    "confidence_level": "medium",
    "response_analysis": [
        {{
            "question_id": "q1",
            "score": 7,
            "content_summary": "what they said",
            "strengths": ["strength 1", "strength 2"],
            "weaknesses": ["weakness 1"],
            "key_points_mentioned": ["point 1", "point 2"],
            "missed_topics": ["topic 1"],
            "notable_moments": [{{"timestamp": "01:30", "observation": "showed enthusiasm"}}]
        }}
    ],
    "communication_assessment": {{
        "clarity_score": 7,
        "articulation": "Clear and well-paced speech",
        "structure": "Responses were logically organized",
        "filler_word_frequency": "moderate",
        "pace": "good",
        "vocabulary_level": "professional"
    }},
    "behavioral_assessment": {{
        "enabled": true,
        "confidence_indicators": {{
            "score": 7,
            "observations": ["maintained good posture", "spoke with conviction"]
        }},
        "engagement_indicators": {{
            "score": 8,
            "observations": ["showed genuine interest", "asked clarifying questions"]
        }},
        "body_language_notes": ["open posture", "appropriate hand gestures"],
        "stress_indicators": ["brief pause when discussing challenges"],
        "positive_signals": ["smiled naturally", "showed enthusiasm for the role"]
    }},
    "summary": {{
        "top_strengths": ["strength 1", "strength 2", "strength 3"],
        "areas_of_concern": ["concern 1", "concern 2"],
        "hiring_recommendation": "Recommended for next round based on...",
        "suggested_follow_up_questions": ["question 1", "question 2"]
    }},
    "transcription": {{
        "full_text": "Full transcription of what the candidate said...",
        "segments": [
            {{"start": "00:00", "end": "01:30", "text": "segment text..."}}
        ]
    }}
}}"""

        try:
            # Create a temporary file for the video
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(video_bytes)
                tmp_path = tmp.name

            try:
                # Upload file to Gemini
                logger.info("Uploading video to Gemini for analysis...")
                video_file = await asyncio.to_thread(
                    client.files.upload, file=tmp_path
                )

                # Wait for processing

                while video_file.state.name == "PROCESSING":
                    logger.info("Waiting for video processing...")
                    await asyncio.sleep(2)
                    video_file = await asyncio.to_thread(
                        client.files.get, name=video_file.name
                    )

                if video_file.state.name != "ACTIVE":
                    raise Exception(f"Video processing failed: {video_file.state.name}")

                logger.info("Video processed, running analysis...")

                # Generate content with video
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.model,
                    contents=[
                        types.Content(
                            parts=[
                                types.Part(file_data=video_file),
                                types.Part(text=prompt),
                            ]
                        )
                    ],
                )

                # Clean up uploaded file
                await asyncio.to_thread(client.files.delete, name=video_file.name)

            finally:
                # Clean up temp file
                os.unlink(tmp_path)

            # Parse response
            response_text = response.text
            if response_text:
                cleaned = response_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                import json

                return json.loads(cleaned)

        except Exception as e:
            logger.error(f"Video analysis with Gemini failed: {e}")
            # Return fallback analysis using frame-based approach
            return await self._fallback_frame_analysis(video_bytes, questions)

        # Return empty analysis on complete failure
        return {
            "overall_score": 0,
            "recommendation": "MAYBE",
            "confidence_level": "low",
            "response_analysis": [],
            "communication_assessment": {},
            "behavioral_assessment": {"enabled": False},
            "summary": {
                "top_strengths": [],
                "areas_of_concern": ["Analysis could not be completed"],
                "hiring_recommendation": "Manual review required",
                "suggested_follow_up_questions": [],
            },
        }

    async def _fallback_frame_analysis(
        self,
        video_bytes: bytes,
        questions: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Fallback to frame-based analysis if full video analysis fails.

        Args:
            video_bytes: Video content as bytes
            questions: List of assessment questions

        Returns:
            Analysis based on extracted frames
        """
        logger.info("Using fallback frame-based analysis")

        # Extract frames
        frames = self.extract_key_frames(video_bytes, num_frames=8)

        if not frames:
            logger.warning("No frames could be extracted")
            return {
                "overall_score": 0,
                "recommendation": "MAYBE",
                "confidence_level": "low",
                "response_analysis": [],
                "communication_assessment": {},
                "behavioral_assessment": {"enabled": False},
                "summary": {
                    "top_strengths": [],
                    "areas_of_concern": ["Video analysis unavailable"],
                    "hiring_recommendation": "Manual review required",
                    "suggested_follow_up_questions": [],
                },
            }

        # Analyze frames in parallel
        frame_analyses = await asyncio.gather(
            *[
                self.analyze_frame(frame_bytes, timestamp)
                for timestamp, frame_bytes in frames
            ]
        )

        # Aggregate results
        confidence_scores = [fa.confidence_level for fa in frame_analyses]
        avg_confidence = sum(confidence_scores) / len(confidence_scores)

        all_observations = []
        body_language_notes = []
        for fa in frame_analyses:
            all_observations.extend(fa.observations)
            if fa.body_language != "Unable to analyze":
                body_language_notes.append(f"[{fa.timestamp}] {fa.body_language}")

        return {
            "overall_score": int(avg_confidence * 10),  # Scale to 0-100
            "recommendation": "YES" if avg_confidence >= 6 else "MAYBE",
            "confidence_level": "low",
            "response_analysis": [
                {
                    "question_id": f"q{i+1}",
                    "score": 5,
                    "content_summary": "Frame-based analysis only - content not available",
                    "strengths": [],
                    "weaknesses": [],
                    "key_points_mentioned": [],
                    "missed_topics": [],
                    "notable_moments": [],
                }
                for i, q in enumerate(questions or [])
            ],
            "communication_assessment": {
                "clarity_score": 5,
                "articulation": "Audio analysis not available in fallback mode",
                "structure": "N/A",
                "filler_word_frequency": "unknown",
                "pace": "unknown",
                "vocabulary_level": "unknown",
            },
            "behavioral_assessment": {
                "enabled": True,
                "confidence_indicators": {
                    "score": int(avg_confidence),
                    "observations": [
                        fa.observations[0]
                        for fa in frame_analyses
                        if fa.observations
                    ][:3],
                },
                "engagement_indicators": {
                    "score": int(avg_confidence),
                    "observations": all_observations[:3],
                },
                "body_language_notes": body_language_notes[:5],
                "stress_indicators": [],
                "positive_signals": [
                    fa.eye_contact
                    for fa in frame_analyses
                    if "good" in fa.eye_contact.lower() or "contact" in fa.eye_contact.lower()
                ][:3],
            },
            "summary": {
                "top_strengths": ["Frame-based behavioral analysis completed"],
                "areas_of_concern": ["Full video analysis unavailable - manual review recommended"],
                "hiring_recommendation": "Partial analysis completed. Review video manually for content assessment.",
                "suggested_follow_up_questions": [],
            },
        }

    async def transcribe_audio(self, video_bytes: bytes) -> TranscriptionResult:
        """Transcribe audio from video using Gemini.

        Args:
            video_bytes: Video content as bytes

        Returns:
            TranscriptionResult with full text and segments
        """
        try:
            # Create temp file
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(video_bytes)
                tmp_path = tmp.name

            try:
                # Upload to Gemini
                video_file = await asyncio.to_thread(
                    client.files.upload, file=tmp_path
                )

                # Wait for processing
                while video_file.state.name == "PROCESSING":
                    await asyncio.sleep(2)
                    video_file = await asyncio.to_thread(
                        client.files.get, name=video_file.name
                    )

                if video_file.state.name != "ACTIVE":
                    raise Exception(f"Video processing failed: {video_file.state.name}")

                # Generate transcription
                prompt = """Transcribe all spoken audio from this video.

Provide the transcription in this JSON format:
{
    "full_text": "Complete transcription of all speech...",
    "segments": [
        {"start": "00:00", "end": "00:30", "text": "segment text..."},
        {"start": "00:30", "end": "01:00", "text": "segment text..."}
    ],
    "confidence": 0.95
}

Include timestamps for major segments (roughly 30-second intervals or natural breaks).
Only transcribe actual speech - ignore background noise."""

                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.model,
                    contents=[
                        types.Content(
                            parts=[
                                types.Part(file_data=video_file),
                                types.Part(text=prompt),
                            ]
                        )
                    ],
                )

                # Clean up
                await asyncio.to_thread(client.files.delete, name=video_file.name)

            finally:
                os.unlink(tmp_path)

            # Parse response
            response_text = response.text
            if response_text:
                cleaned = response_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                import json

                data = json.loads(cleaned)
                return TranscriptionResult(
                    status="success",
                    video_url="",
                    transcription=data,
                )

        except Exception as e:
            logger.error(f"Transcription failed: {e}")

        return TranscriptionResult(
            status="error",
            video_url="",
            transcription={
                "full_text": "",
                "segments": [],
                "confidence": 0.0,
            },
        )

    async def analyze_video_segment(
        self,
        video_url: str,
        start_time: str,
        end_time: str,
        analysis_type: str,
    ) -> VideoSegmentAnalysis:
        """Analyze a specific segment of video.

        Args:
            video_url: URL or path to video in storage
            start_time: Start time in MM:SS format
            end_time: End time in MM:SS format
            analysis_type: Type of analysis (content, behavior, communication)

        Returns:
            VideoSegmentAnalysis with results
        """
        try:
            # Download video
            video_bytes = await self.download_video(video_url)

            # Convert timestamps to seconds
            def time_to_seconds(time_str: str) -> float:
                parts = time_str.split(":")
                if len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
                return 0.0

            start_sec = time_to_seconds(start_time)
            end_sec = time_to_seconds(end_time)

            # Extract segment using ffmpeg
            with tempfile.TemporaryDirectory() as temp_dir:
                input_path = Path(temp_dir) / "input.webm"
                output_path = Path(temp_dir) / "segment.webm"

                with open(input_path, "wb") as f:
                    f.write(video_bytes)

                # Extract segment
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-i",
                    str(input_path),
                    "-ss",
                    str(start_sec),
                    "-t",
                    str(end_sec - start_sec),
                    "-c",
                    "copy",
                    "-y",
                    str(output_path),
                ]

                subprocess.run(ffmpeg_cmd, capture_output=True, check=True)

                with open(output_path, "rb") as f:
                    segment_bytes = f.read()

            # Analyze based on type
            analysis_prompt = ""
            if analysis_type == "content":
                analysis_prompt = "Focus on WHAT the candidate is saying. Summarize key points and assess completeness."
            elif analysis_type == "behavior":
                analysis_prompt = "Focus on body language, eye contact, confidence indicators, and engagement."
            elif analysis_type == "communication":
                analysis_prompt = "Focus on clarity, articulation, pace, vocabulary, and communication effectiveness."

            # Run analysis on segment
            result = await self.analyze_video_with_gemini(
                segment_bytes,
                questions=None,
                job_context=f"Analyzing segment from {start_time} to {end_time}. {analysis_prompt}",
            )

            # Extract relevant part based on analysis type
            analysis_data: dict[str, Any] = {
                "content": "",
                "observations": [],
                "scores": {
                    "confidence": 5,
                    "communication": 5,
                    "body_language": 5,
                    "eye_contact": 5,
                },
            }

            if analysis_type == "content":
                if result.get("response_analysis"):
                    ra = result["response_analysis"][0]
                    analysis_data["content"] = ra.get("content_summary", "")
                    analysis_data["observations"] = ra.get("key_points_mentioned", [])
            elif analysis_type == "behavior":
                ba = result.get("behavioral_assessment", {})
                analysis_data["observations"] = ba.get("body_language_notes", [])
                analysis_data["scores"]["confidence"] = ba.get(
                    "confidence_indicators", {}
                ).get("score", 5)
                analysis_data["scores"]["body_language"] = ba.get(
                    "engagement_indicators", {}
                ).get("score", 5)
            elif analysis_type == "communication":
                ca = result.get("communication_assessment", {})
                analysis_data["content"] = ca.get("articulation", "")
                analysis_data["scores"]["communication"] = ca.get("clarity_score", 5)
                analysis_data["observations"] = [
                    f"Pace: {ca.get('pace', 'unknown')}",
                    f"Vocabulary: {ca.get('vocabulary_level', 'unknown')}",
                    f"Filler words: {ca.get('filler_word_frequency', 'unknown')}",
                ]

            return VideoSegmentAnalysis(
                status="success",
                video_url=video_url,
                segment={"start": start_time, "end": end_time},
                analysis_type=analysis_type,
                analysis=analysis_data,
            )

        except Exception as e:
            logger.error(f"Segment analysis failed: {e}")
            return VideoSegmentAnalysis(
                status="error",
                video_url=video_url,
                segment={"start": start_time, "end": end_time},
                analysis_type=analysis_type,
                analysis={
                    "content": "",
                    "observations": [f"Analysis failed: {str(e)}"],
                    "scores": {
                        "confidence": 0,
                        "communication": 0,
                        "body_language": 0,
                        "eye_contact": 0,
                    },
                },
            )


# Singleton instance
video_analyzer = VideoAnalyzer()
