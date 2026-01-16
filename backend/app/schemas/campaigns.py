"""Campaign and outreach related Pydantic schemas."""

from datetime import datetime
from typing import Optional, Any
from enum import Enum

from pydantic import BaseModel, Field


# ============================================
# ENUMS
# ============================================


class CampaignStatus(str, Enum):
    """Campaign status."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class MessageStatus(str, Enum):
    """Outreach message status."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    REPLIED = "replied"
    BOUNCED = "bounced"
    FAILED = "failed"


class MessageChannel(str, Enum):
    """Message delivery channel."""
    EMAIL = "email"
    LINKEDIN = "linkedin"
    SMS = "sms"


# ============================================
# SEQUENCE STEP SCHEMAS
# ============================================


class SequenceStep(BaseModel):
    """A single step in a campaign sequence."""

    step_number: int = Field(..., ge=1, description="Order in sequence")
    channel: MessageChannel = Field(default=MessageChannel.EMAIL)
    template_id: Optional[str] = Field(None, description="Email template ID")
    subject_line: Optional[str] = Field(None, description="Email subject (can include {{variables}})")
    message_body: str = Field(..., description="Message body (can include {{variables}})")
    delay_days: int = Field(default=0, ge=0, description="Days to wait after previous step")
    delay_hours: int = Field(default=0, ge=0, description="Additional hours to wait")
    send_on_days: list[int] = Field(
        default=[1, 2, 3, 4, 5],
        description="Days of week to send (1=Mon, 7=Sun)"
    )
    send_after_hour: int = Field(default=9, ge=0, le=23, description="Earliest hour to send")
    send_before_hour: int = Field(default=17, ge=0, le=23, description="Latest hour to send")


# ============================================
# REQUEST SCHEMAS
# ============================================


class CampaignCreateRequest(BaseModel):
    """Request to create a new campaign."""

    name: str = Field(..., description="Campaign name")
    job_id: str = Field(..., description="Job ID this campaign is for")
    description: Optional[str] = Field(None, description="Campaign description")
    sequence: list[SequenceStep] = Field(..., min_length=1, description="Outreach sequence steps")
    sender_email: Optional[str] = Field(None, description="From email address")
    sender_name: Optional[str] = Field(None, description="From name")
    reply_to_email: Optional[str] = Field(None, description="Reply-to address")


class CampaignUpdateRequest(BaseModel):
    """Request to update a campaign."""

    name: Optional[str] = None
    description: Optional[str] = None
    sequence: Optional[list[SequenceStep]] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    reply_to_email: Optional[str] = None


class CampaignStatusUpdateRequest(BaseModel):
    """Request to update campaign status."""

    status: CampaignStatus


class AddCandidatesToCampaignRequest(BaseModel):
    """Request to add candidates to a campaign."""

    sourced_candidate_ids: list[str] = Field(..., description="Sourced candidate IDs to add")


class SendMessageRequest(BaseModel):
    """Request to manually send a message."""

    sourced_candidate_id: str
    step_number: int = Field(default=1, description="Which sequence step to send")


# ============================================
# RESPONSE SCHEMAS
# ============================================


class CampaignResponse(BaseModel):
    """Response for a campaign."""

    id: str
    job_id: str
    name: str
    description: Optional[str] = None
    status: str = "draft"

    # Sequence configuration
    sequence: list[SequenceStep] = Field(default_factory=list)

    # Sender settings
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    reply_to_email: Optional[str] = None

    # Statistics
    total_recipients: int = 0
    messages_sent: int = 0
    messages_opened: int = 0
    messages_clicked: int = 0
    messages_replied: int = 0

    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CampaignListResponse(BaseModel):
    """Response for listing campaigns."""

    total: int
    campaigns: list[CampaignResponse]


class OutreachMessageResponse(BaseModel):
    """Response for an outreach message."""

    id: str
    campaign_id: str
    sourced_candidate_id: str
    step_number: int
    channel: str

    # Content
    subject_line: Optional[str] = None
    message_body: str
    personalized_body: Optional[str] = None

    # Status tracking
    status: str = "pending"
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None

    # Provider tracking
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None

    # Reply handling
    reply_content: Optional[str] = None

    # Timestamps
    scheduled_for: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Nested data
    sourced_candidate: Optional[dict[str, Any]] = None

    class Config:
        from_attributes = True


class OutreachMessageListResponse(BaseModel):
    """Response for listing outreach messages."""

    total: int
    messages: list[OutreachMessageResponse]


class CampaignStatsResponse(BaseModel):
    """Detailed statistics for a campaign."""

    campaign_id: str
    total_recipients: int

    # Delivery stats
    pending: int
    sent: int
    delivered: int
    bounced: int
    failed: int

    # Engagement stats
    opened: int
    clicked: int
    replied: int

    # Rates
    open_rate: float = Field(description="Percentage of delivered that were opened")
    click_rate: float = Field(description="Percentage of opened that were clicked")
    reply_rate: float = Field(description="Percentage of delivered that replied")
    bounce_rate: float = Field(description="Percentage of sent that bounced")

    # By step breakdown
    by_step: list[dict[str, Any]] = Field(default_factory=list)


# ============================================
# WEBHOOK SCHEMAS
# ============================================


class SendGridWebhookEvent(BaseModel):
    """SendGrid webhook event payload."""

    email: str
    event: str  # delivered, open, click, bounce, dropped, etc.
    timestamp: int
    sg_message_id: Optional[str] = None
    url: Optional[str] = None  # For click events
    reason: Optional[str] = None  # For bounce/drop events
    category: Optional[list[str]] = None


class SendGridWebhookPayload(BaseModel):
    """SendGrid webhook payload (array of events)."""

    events: list[SendGridWebhookEvent]
