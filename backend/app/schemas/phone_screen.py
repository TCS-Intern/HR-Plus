"""Phone screen related Pydantic schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ============================================
# REQUEST SCHEMAS
# ============================================


class PhoneScreenScheduleRequest(BaseModel):
    """Request to schedule a phone screen."""

    application_id: str = Field(..., description="Application UUID")
    phone_number: str = Field(..., description="Candidate phone number (E.164 format)")
    scheduled_at: datetime | None = Field(
        None, description="When to call. If None, calls immediately."
    )


class PhoneScreenAnalyzeRequest(BaseModel):
    """Request to re-analyze a phone screen."""

    phone_screen_id: str = Field(..., description="Phone screen UUID")
    force: bool = Field(False, description="Force re-analysis even if already analyzed")


# ============================================
# ANALYSIS SCHEMAS
# ============================================


class SkillDiscussed(BaseModel):
    """A skill that was discussed during the phone screen."""

    skill: str = Field(..., description="Skill name")
    proficiency: str = Field(
        ..., description="Proficiency level: none, basic, intermediate, advanced, expert"
    )
    evidence: str = Field(..., description="Quote or evidence from the conversation")


class CompensationExpectation(BaseModel):
    """Candidate's compensation expectations."""

    min_salary: float | None = Field(None, description="Minimum acceptable salary")
    max_salary: float | None = Field(None, description="Maximum expected salary")
    currency: str = Field("USD", description="Currency code")
    notes: str = Field("", description="Additional notes about compensation")


class Availability(BaseModel):
    """Candidate's availability information."""

    start_date: str | None = Field(None, description="Earliest start date")
    notice_period: str | None = Field(None, description="Notice period required")
    flexible: bool = Field(True, description="Is the start date flexible?")
    notes: str = Field("", description="Additional availability notes")


class PhoneScreenAnalysis(BaseModel):
    """AI-generated analysis of a phone screen."""

    skills_discussed: list[SkillDiscussed] = Field(
        default_factory=list, description="Skills discussed with evidence"
    )
    compensation_expectations: CompensationExpectation | None = Field(
        None, description="Compensation expectations"
    )
    availability: Availability | None = Field(None, description="Availability info")
    experience_highlights: list[str] = Field(
        default_factory=list, description="Key experience highlights"
    )
    communication_score: float = Field(0, ge=0, le=100, description="Communication quality score")
    enthusiasm_score: float = Field(0, ge=0, le=100, description="Enthusiasm/engagement score")
    technical_depth_score: float = Field(0, ge=0, le=100, description="Technical depth score")
    red_flags: list[str] = Field(default_factory=list, description="Concerns or red flags")
    strengths: list[str] = Field(default_factory=list, description="Key strengths identified")
    summary: str = Field("", description="Overall summary of the candidate")


class PhoneScreenSummary(BaseModel):
    """Quick summary for display in UI."""

    key_takeaways: list[str] = Field(default_factory=list, description="Main takeaways")
    compensation_range: str = Field("", description="Formatted compensation range")
    availability: str = Field("", description="Formatted availability")
    recommendation_reason: str = Field("", description="Why this recommendation")


# ============================================
# TRANSCRIPT SCHEMAS
# ============================================


class TranscriptMessage(BaseModel):
    """A single message in the transcript."""

    role: str = Field(..., description="'assistant' or 'user'")
    content: str = Field(..., description="Message content")
    timestamp: str | None = Field(None, description="ISO timestamp")
    duration_ms: int | None = Field(None, description="Duration of speech in ms")


# ============================================
# RESPONSE SCHEMAS
# ============================================


class PhoneScreenResponse(BaseModel):
    """Phone screen record response."""

    id: str
    application_id: str
    vapi_call_id: str | None = None
    phone_number: str | None = None

    # Scheduling
    scheduled_at: datetime | None = None
    scheduled_by: str | None = None

    # Call details
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    ended_reason: str | None = None

    # Recording
    recording_url: str | None = None

    # Transcript
    transcript: list[TranscriptMessage] = Field(default_factory=list)

    # Analysis
    analysis: PhoneScreenAnalysis | None = None
    overall_score: float | None = None
    recommendation: str | None = None  # STRONG_YES, YES, MAYBE, NO
    confidence_level: str | None = None  # high, medium, low
    summary: PhoneScreenSummary | None = None

    # Status
    status: str = "scheduled"
    attempt_number: int = 1
    error_message: str | None = None

    # Timestamps
    analyzed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PhoneScreenListResponse(BaseModel):
    """Response for listing phone screens."""

    total: int
    phone_screens: list[PhoneScreenResponse]


class PhoneScreenWithCandidateResponse(PhoneScreenResponse):
    """Phone screen with candidate and job data."""

    candidate: dict[str, Any] | None = None
    job: dict[str, Any] | None = None


# ============================================
# WEBHOOK SCHEMAS
# ============================================


class VapiWebhookPayload(BaseModel):
    """Vapi webhook payload structure."""

    type: str = Field(..., description="Event type: call-started, call-ended, transcript, etc.")

    # Call identification
    call: dict[str, Any] | None = Field(None, description="Call object")

    # For backwards compatibility with different payload structures
    call_id: str | None = Field(None, description="Call ID (legacy)")

    # Transcript data (for transcript events)
    messages: list[dict] | None = Field(None, description="Transcript messages")
    transcript: list[dict] | None = Field(None, description="Transcript (alternative key)")

    # Call metadata
    timestamp: datetime | None = None
    duration_seconds: int | None = None
    recording_url: str | None = None
    ended_reason: str | None = None

    def get_call_id(self) -> str | None:
        """Extract call ID from various payload formats."""
        if self.call and "id" in self.call:
            return self.call["id"]
        return self.call_id

    def get_transcript(self) -> list[dict]:
        """Get transcript from various payload formats."""
        if self.messages:
            return self.messages
        if self.transcript:
            return self.transcript
        if self.call and "messages" in self.call:
            return self.call["messages"]
        return []

    def get_recording_url(self) -> str | None:
        """Get recording URL from various payload formats."""
        if self.recording_url:
            return self.recording_url
        if self.call:
            return self.call.get("recordingUrl") or self.call.get("recording_url")
        return None

    def get_duration(self) -> int | None:
        """Get duration from various payload formats."""
        if self.duration_seconds:
            return self.duration_seconds
        if self.call:
            return self.call.get("duration") or self.call.get("durationSeconds")
        return None

    def get_ended_reason(self) -> str | None:
        """Get ended reason from various payload formats."""
        if self.ended_reason:
            return self.ended_reason
        if self.call:
            return self.call.get("endedReason") or self.call.get("ended_reason")
        return None
