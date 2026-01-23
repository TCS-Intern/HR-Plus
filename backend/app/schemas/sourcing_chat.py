"""
Schemas for chatbot-based candidate sourcing
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ConversationStage(str, Enum):
    """Stages in the sourcing conversation"""

    GREETING = "greeting"
    REQUIREMENTS_GATHERING = "requirements_gathering"
    CONFIRMATION = "confirmation"
    SOURCING = "sourcing"
    PRESENTING_RESULTS = "presenting_results"
    REFINEMENT = "refinement"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class MessageRole(str, Enum):
    """Message role in conversation"""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageType(str, Enum):
    """Types of messages in conversation"""

    TEXT = "text"
    QUESTION = "question"
    CANDIDATE_CARDS = "candidate_cards"
    THINKING = "thinking"
    ERROR = "error"


class SourcingCriteria(BaseModel):
    """Extracted sourcing criteria from conversation"""

    role: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    experience_years_min: Optional[int] = None
    experience_years_max: Optional[int] = None
    location: Optional[str] = None
    remote_policy: Optional[str] = None  # "remote_only", "hybrid", "onsite", "remote_ok"
    company_size: Optional[str] = None
    industry: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    education: Optional[str] = None
    additional_criteria: Dict[str, Any] = Field(default_factory=dict)


class ConversationCreate(BaseModel):
    """Request to start a new conversation"""

    job_id: Optional[UUID] = Field(None, description="Optional job ID to link conversation to")
    initial_message: Optional[str] = Field(
        None, description="Optional initial message from user"
    )


class ConversationResponse(BaseModel):
    """Response when creating or fetching conversation"""

    id: UUID
    user_id: UUID
    stage: ConversationStage
    agent_session_id: Optional[str] = None
    thought_signature: Dict[str, Any] = Field(default_factory=dict)
    sourcing_criteria: SourcingCriteria
    job_id: Optional[UUID] = None
    candidates_found_count: int = 0
    candidates_revealed_count: int = 0
    total_messages_count: int = 0
    created_at: datetime
    updated_at: datetime
    last_activity_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    """Request to send a message"""

    conversation_id: UUID
    content: str


class MessageResponse(BaseModel):
    """Response for a single message"""

    id: UUID
    conversation_id: UUID
    role: MessageRole
    message_type: MessageType
    content: Optional[str] = None
    candidate_ids: List[UUID] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


class AnonymizedCandidate(BaseModel):
    """Anonymized candidate data for display"""

    id: UUID
    role: str
    company: Optional[str] = None
    location: Optional[str] = None  # City only
    experience_years: Optional[int] = None
    skills: List[str] = Field(default_factory=list)
    summary: Optional[str] = None  # Truncated
    fit_score: Optional[float] = None
    source: Optional[str] = None
    is_anonymized: bool = True
    name: str  # Masked name like "Candidate #1234"


class RevealedCandidate(BaseModel):
    """Full candidate data after reveal"""

    id: UUID
    role: str
    company: Optional[str] = None
    location: Optional[str] = None
    experience_years: Optional[int] = None
    skills: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    fit_score: Optional[float] = None
    source: Optional[str] = None
    is_anonymized: bool = False
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    already_revealed: bool = False


class RevealRequest(BaseModel):
    """Request to reveal a candidate"""

    candidate_id: UUID
    conversation_id: UUID
    reveal_reason: Optional[str] = Field(
        "interested", description="Reason for revealing (interested, shortlist, interview)"
    )


class RevealResponse(BaseModel):
    """Response after revealing a candidate"""

    success: bool
    candidate: Optional[RevealedCandidate] = None
    credits_charged: int = 0
    new_balance: int = 0
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ConversationWithMessages(BaseModel):
    """Conversation with all messages"""

    conversation: ConversationResponse
    messages: List[MessageResponse]


class CreateJobRequest(BaseModel):
    """Request to create job from conversation"""

    conversation_id: UUID
    additional_fields: Optional[Dict[str, Any]] = Field(
        None, description="Additional fields to override/supplement extracted criteria"
    )


class AddToJobRequest(BaseModel):
    """Request to add candidates to a job"""

    conversation_id: UUID
    candidate_ids: List[UUID]
    job_id: UUID


class SSEEvent(BaseModel):
    """Server-Sent Event structure"""

    event: Literal["thinking", "message_chunk", "candidates", "complete", "error"]
    data: Dict[str, Any]


class StreamThinkingEvent(BaseModel):
    """Thinking event data"""

    status: str = "processing"
    message: Optional[str] = None


class StreamMessageChunk(BaseModel):
    """Message chunk event data"""

    text: str


class StreamCandidatesEvent(BaseModel):
    """Candidates event data"""

    candidates: List[AnonymizedCandidate]
    total_found: int
    showing_count: int
    platforms: List[str]


class StreamCompleteEvent(BaseModel):
    """Complete event data"""

    status: str = "done"
    conversation_id: UUID
    message_id: UUID


class StreamErrorEvent(BaseModel):
    """Error event data"""

    error: str
    message: str
    retry_allowed: bool = True
