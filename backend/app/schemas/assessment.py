"""Assessment-related Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class QuestionRubric(BaseModel):
    """Evaluation rubric for a question."""

    excellent: str = ""
    good: str = ""
    adequate: str = ""
    poor: str = ""


class AssessmentQuestion(BaseModel):
    """Individual assessment question."""

    question_id: str
    question_type: str  # technical, behavioral, situational
    question_text: str
    follow_up_prompts: list[str] = []
    time_limit_seconds: int = 180
    evaluation_rubric: QuestionRubric = QuestionRubric()
    key_topics_to_cover: list[str] = []
    related_skills: list[str] = []


class AssessmentInstructions(BaseModel):
    """Instructions for the candidate."""

    candidate_intro: str = ""
    time_management_tips: str = ""
    technical_requirements: str = ""


class AssessmentQuestionsResponse(BaseModel):
    """Response schema for generated assessment questions."""

    assessment_id: UUID | str | None = None
    questions: list[AssessmentQuestion] = []
    instructions: AssessmentInstructions = AssessmentInstructions()


class AssessmentScheduleRequest(BaseModel):
    """Request schema for scheduling an assessment."""

    application_id: UUID | str
    candidate_email: str
    preferred_times: list[datetime] = []
    duration_minutes: int = 30


class NotableMoment(BaseModel):
    """Notable moment in video analysis."""

    timestamp: str  # MM:SS format
    observation: str


class ResponseAnalysis(BaseModel):
    """Analysis of a single response."""

    question_id: str
    score: float = 0
    strengths: list[str] = []
    weaknesses: list[str] = []
    key_points_mentioned: list[str] = []
    missed_topics: list[str] = []
    notable_moments: list[NotableMoment] = []


class CommunicationAssessment(BaseModel):
    """Communication skills assessment."""

    clarity_score: float = 0
    articulation: str = ""
    structure: str = ""
    filler_word_frequency: str = "moderate"  # low, moderate, high
    pace: str = "good"  # too_slow, good, too_fast
    vocabulary_level: str = "professional"  # basic, professional, expert


class BehavioralIndicators(BaseModel):
    """Behavioral indicators from video."""

    score: float = 0
    observations: list[str] = []


class BehavioralAssessment(BaseModel):
    """Behavioral assessment (optional)."""

    enabled: bool = True
    confidence_indicators: BehavioralIndicators = BehavioralIndicators()
    engagement_indicators: BehavioralIndicators = BehavioralIndicators()
    body_language_notes: list[str] = []
    stress_indicators: list[str] = []
    positive_signals: list[str] = []


class AssessmentSummary(BaseModel):
    """Summary of assessment analysis."""

    top_strengths: list[str] = []
    areas_of_concern: list[str] = []
    hiring_recommendation: str = ""
    suggested_follow_up_questions: list[str] = []


class AssessmentAnalysisResponse(BaseModel):
    """Response schema for assessment analysis."""

    assessment_id: UUID | str
    overall_score: float = 0
    recommendation: str = "MAYBE"  # STRONG_YES, YES, MAYBE, NO
    confidence_level: str = "medium"  # high, medium, low
    response_analysis: list[ResponseAnalysis] = []
    communication_assessment: CommunicationAssessment = CommunicationAssessment()
    behavioral_assessment: BehavioralAssessment = BehavioralAssessment()
    summary: AssessmentSummary = AssessmentSummary()
