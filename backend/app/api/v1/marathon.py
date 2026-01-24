"""Marathon Agent API endpoints."""

from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.marathon_agent import marathon_agent
from app.services.supabase import db

router = APIRouter()


# ============================================
# REQUEST/RESPONSE SCHEMAS
# ============================================


class MarathonStartRequest(BaseModel):
    """Request to start a marathon for a candidate."""

    job_id: str = Field(..., description="Job UUID")
    application_id: str = Field(..., description="Application UUID")
    initial_data: dict[str, Any] | None = Field(
        None, description="Optional initial screening data"
    )


class MarathonStateResponse(BaseModel):
    """Response for marathon state."""

    id: str
    job_id: str
    application_id: str | None
    thought_signature: dict[str, Any]
    decision_confidence: float
    current_stage: str
    stage_status: str
    can_auto_advance: bool
    requires_human_review: bool
    correction_count: int
    next_scheduled_action: str | None
    created_at: str
    updated_at: str

    # Enriched data (from joins)
    job_title: str | None = None
    department: str | None = None
    application_stage: str | None = None


class MarathonDecisionResponse(BaseModel):
    """Response for a marathon decision."""

    decision: str
    confidence: float
    reasoning: str
    corrections: List[dict[str, Any]]
    next_action: str


class MarathonDashboardMetrics(BaseModel):
    """Metrics for the marathon dashboard."""

    active_marathons: int
    escalations_pending: int
    self_corrections_today: int
    avg_confidence: float
    autonomy_rate: float  # % of decisions made without human input


# ============================================
# ENDPOINTS
# ============================================


@router.post("/start", response_model=MarathonStateResponse)
async def start_marathon(request: MarathonStartRequest) -> dict[str, Any]:
    """
    Start a new marathon hiring process for a candidate.

    This initializes the Marathon Agent to autonomously manage the candidate
    through multiple stages over days/weeks.
    """
    # Verify job and application exist
    job = await db.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    application = await db.execute(
        "SELECT * FROM applications WHERE id = $1", request.application_id
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Start the marathon
    result = await marathon_agent.start_marathon(
        job_id=request.job_id,
        application_id=request.application_id,
        initial_data=request.initial_data,
    )

    return result


@router.get("/active", response_model=List[MarathonStateResponse])
async def list_active_marathons(limit: int = 50) -> List[dict[str, Any]]:
    """
    Get all active marathon processes.

    Returns marathons that are currently pending, in progress, or blocked.
    """
    marathons = await marathon_agent.get_active_marathons(limit=limit)
    return marathons


@router.get("/review", response_model=List[MarathonStateResponse])
async def list_marathons_requiring_review() -> List[dict[str, Any]]:
    """
    Get all marathons that require human review.

    These are marathons where the agent escalated due to uncertainty
    or conflicting signals.
    """
    marathons = await marathon_agent.get_marathons_requiring_review()
    return marathons


@router.get("/metrics", response_model=MarathonDashboardMetrics)
async def get_marathon_metrics() -> dict[str, Any]:
    """Get metrics for the marathon dashboard."""
    from datetime import datetime, timedelta

    # Active marathons count
    active_result = await db.execute(
        """
        SELECT COUNT(*) as count
        FROM marathon_agent_state
        WHERE stage_status IN ('pending', 'in_progress', 'blocked')
        """
    )
    active_count = active_result["count"] if active_result else 0

    # Escalations pending
    escalations_result = await db.execute(
        """
        SELECT COUNT(*) as count
        FROM marathon_agent_state
        WHERE requires_human_review = true
          AND stage_status = 'escalated'
        """
    )
    escalations_count = escalations_result["count"] if escalations_result else 0

    # Self-corrections today
    today = datetime.utcnow().date()
    corrections_result = await db.execute(
        """
        SELECT SUM(correction_count) as total
        FROM marathon_agent_state
        WHERE DATE(last_correction_at) = $1
        """,
        today,
    )
    corrections_today = corrections_result.get("total", 0) if corrections_result else 0

    # Average confidence
    confidence_result = await db.execute(
        """
        SELECT AVG(decision_confidence) as avg_conf
        FROM marathon_agent_state
        WHERE stage_status IN ('pending', 'in_progress', 'escalated')
        """
    )
    avg_confidence = confidence_result.get("avg_conf", 0.0) if confidence_result else 0.0

    # Autonomy rate (% of decisions made without human input)
    # Count decisions vs escalations
    decisions_result = await db.execute(
        """
        SELECT
            COUNT(*) FILTER (WHERE decision_type IN ('advance', 'reject')) as autonomous,
            COUNT(*) FILTER (WHERE decision_type = 'escalate') as escalated
        FROM marathon_agent_decisions
        WHERE created_at >= $1
        """,
        datetime.utcnow() - timedelta(days=7),
    )

    autonomous = decisions_result.get("autonomous", 0) if decisions_result else 0
    escalated = decisions_result.get("escalated", 0) if decisions_result else 0
    total_decisions = autonomous + escalated

    autonomy_rate = (autonomous / total_decisions * 100) if total_decisions > 0 else 0.0

    return {
        "active_marathons": active_count,
        "escalations_pending": escalations_count,
        "self_corrections_today": corrections_today or 0,
        "avg_confidence": float(avg_confidence) if avg_confidence else 0.0,
        "autonomy_rate": autonomy_rate,
    }


@router.post("/{marathon_id}/process", response_model=MarathonDecisionResponse)
async def process_marathon_stage(marathon_id: UUID) -> dict[str, Any]:
    """
    Manually trigger processing of a marathon stage.

    This is useful for testing or forcing immediate processing
    instead of waiting for the background worker.
    """
    try:
        result = await marathon_agent.process_stage(str(marathon_id))
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.get("/{marathon_id}", response_model=MarathonStateResponse)
async def get_marathon_state(marathon_id: UUID) -> dict[str, Any]:
    """Get the current state of a marathon."""
    result = await db.execute(
        """
        SELECT
            m.*,
            j.title as job_title,
            j.department,
            a.stage as application_stage
        FROM marathon_agent_state m
        LEFT JOIN jobs j ON m.job_id = j.id
        LEFT JOIN applications a ON m.application_id = a.id
        WHERE m.id = $1
        """,
        str(marathon_id),
    )

    if not result:
        raise HTTPException(status_code=404, detail="Marathon not found")

    return result


@router.get("/{marathon_id}/decisions", response_model=List[dict[str, Any]])
async def get_marathon_decisions(marathon_id: UUID, limit: int = 50) -> List[dict[str, Any]]:
    """Get all decisions made for a marathon."""
    decisions = await db.execute(
        """
        SELECT *
        FROM marathon_agent_decisions
        WHERE marathon_state_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        str(marathon_id),
        limit,
    )

    return decisions or []


@router.get("/{marathon_id}/events", response_model=List[dict[str, Any]])
async def get_marathon_events(marathon_id: UUID, limit: int = 100) -> List[dict[str, Any]]:
    """Get all events for a marathon (audit trail)."""
    events = await db.execute(
        """
        SELECT *
        FROM marathon_agent_events
        WHERE marathon_state_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        str(marathon_id),
        limit,
    )

    return events or []


@router.post("/{marathon_id}/approve")
async def approve_marathon_decision(marathon_id: UUID) -> dict[str, Any]:
    """
    Approve an escalated marathon and advance to next stage.

    This is called when a human reviews an escalated decision
    and decides to proceed.
    """
    # Get current state
    state = await db.execute(
        "SELECT * FROM marathon_agent_state WHERE id = $1", str(marathon_id)
    )

    if not state:
        raise HTTPException(status_code=404, detail="Marathon not found")

    if not state.get("requires_human_review"):
        raise HTTPException(status_code=400, detail="Marathon does not require review")

    # Mark as approved and continue
    await db.execute(
        """
        UPDATE marathon_agent_state
        SET requires_human_review = false,
            stage_status = 'pending',
            escalation_reason = NULL,
            next_scheduled_action = NOW()
        WHERE id = $1
        """,
        str(marathon_id),
    )

    # Record event
    await db.execute(
        """
        INSERT INTO marathon_agent_events
        (marathon_state_id, event_type, message)
        VALUES ($1, 'human_approved', 'Human reviewer approved escalated decision')
        """,
        str(marathon_id),
    )

    return {"status": "approved", "message": "Marathon will continue processing"}


@router.post("/{marathon_id}/reject")
async def reject_marathon_decision(
    marathon_id: UUID, reason: str | None = None
) -> dict[str, Any]:
    """
    Reject an escalated marathon (reject the candidate).

    This is called when a human reviews an escalated decision
    and decides to reject the candidate.
    """
    state = await db.execute(
        "SELECT * FROM marathon_agent_state WHERE id = $1", str(marathon_id)
    )

    if not state:
        raise HTTPException(status_code=404, detail="Marathon not found")

    # Mark as rejected
    await db.execute(
        """
        UPDATE marathon_agent_state
        SET stage_status = 'completed',
            last_agent_action = 'human_reject',
            last_agent_reasoning = $1
        WHERE id = $2
        """,
        reason or "Human reviewer rejected",
        str(marathon_id),
    )

    # Record event
    await db.execute(
        """
        INSERT INTO marathon_agent_events
        (marathon_state_id, event_type, message)
        VALUES ($1, 'human_rejected', $2)
        """,
        str(marathon_id),
        reason or "Human reviewer rejected the candidate",
    )

    return {"status": "rejected", "message": "Candidate rejected"}
