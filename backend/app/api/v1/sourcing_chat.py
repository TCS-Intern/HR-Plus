"""
API endpoints for chatbot-based candidate sourcing with SSE streaming
"""

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.sourcing_chat import (
    AddToJobRequest,
    AnonymizedCandidate,
    ConversationCreate,
    ConversationResponse,
    ConversationStage,
    ConversationWithMessages,
    CreateJobRequest,
    MessageResponse,
    MessageRole,
    MessageType,
    RevealRequest,
    RevealResponse,
    SourcingCriteria,
    StreamCandidatesEvent,
    StreamCompleteEvent,
    StreamErrorEvent,
    StreamMessageChunk,
    StreamThinkingEvent,
)
from app.services.supabase import supabase

router = APIRouter(prefix="/sourcing-chat", tags=["sourcing-chat"])


# =====================================================
# Helper Functions
# =====================================================


async def create_conversation_record(
    user_id: UUID, job_id: UUID | None = None, agent_session_id: str | None = None
) -> dict:
    """Create a new conversation record in Supabase"""
    data = {
        "user_id": str(user_id),
        "stage": ConversationStage.GREETING.value,
        "sourcing_criteria": {},
        "thought_signature": {},
    }

    if job_id:
        data["job_id"] = str(job_id)
    if agent_session_id:
        data["agent_session_id"] = agent_session_id

    result = supabase.table("sourcing_conversations").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create conversation")

    return result.data[0]


async def save_message(
    conversation_id: UUID,
    role: MessageRole,
    message_type: MessageType,
    content: str | None = None,
    candidate_ids: list[UUID] | None = None,
    metadata: dict | None = None,
) -> dict:
    """Save a message to the conversation"""
    data = {
        "conversation_id": str(conversation_id),
        "role": role.value,
        "message_type": message_type.value,
        "content": content,
        "candidate_ids": [str(cid) for cid in (candidate_ids or [])],
        "metadata": metadata or {},
    }

    result = supabase.table("sourcing_messages").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save message")

    return result.data[0]


async def get_conversation(conversation_id: UUID, user_id: UUID) -> dict:
    """Get conversation by ID"""
    result = (
        supabase.table("sourcing_conversations")
        .select("*")
        .eq("id", str(conversation_id))
        .eq("user_id", str(user_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return result.data[0]


async def get_conversation_messages(conversation_id: UUID) -> list[dict]:
    """Get all messages for a conversation"""
    result = (
        supabase.table("sourcing_messages")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .order("created_at", desc=False)
        .execute()
    )

    return result.data or []


async def update_conversation(conversation_id: UUID, updates: dict) -> dict:
    """Update conversation fields"""
    result = (
        supabase.table("sourcing_conversations")
        .update(updates)
        .eq("id", str(conversation_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update conversation")

    return result.data[0]


async def get_anonymized_candidates(candidate_ids: list[UUID]) -> list[AnonymizedCandidate]:
    """Get anonymized candidate data - handles anonymization in code to avoid RPC column mismatch"""
    candidates = []

    for cid in candidate_ids:
        result = supabase.table("sourced_candidates").select("*").eq("id", str(cid)).execute()

        if result.data:
            candidate = result.data[0]
            is_anonymized = candidate.get("is_anonymized", True)

            if is_anonymized:
                # Anonymize PII
                anonymized = AnonymizedCandidate(
                    id=candidate["id"],
                    role=candidate.get("current_title"),
                    company=candidate.get("current_company"),
                    location=(candidate.get("location", "") or "").split(",")[0],  # City only
                    experience_years=candidate.get("experience_years"),
                    skills=candidate.get("skills", []),
                    summary=(candidate.get("summary", "") or "")[:200] + "..."
                    if len(candidate.get("summary", "") or "") > 200
                    else candidate.get("summary"),
                    fit_score=candidate.get("fit_score"),
                    source=candidate.get("source"),
                    is_anonymized=True,
                    name=f"Candidate #{str(candidate['id'])[:8]}",
                    email=None,
                    phone=None,
                    linkedin_url=None,
                )
            else:
                # Return full data
                anonymized = AnonymizedCandidate(
                    id=candidate["id"],
                    role=candidate.get("current_title"),
                    company=candidate.get("current_company"),
                    location=candidate.get("location"),
                    experience_years=candidate.get("experience_years"),
                    skills=candidate.get("skills", []),
                    summary=candidate.get("summary"),
                    fit_score=candidate.get("fit_score"),
                    source=candidate.get("source"),
                    is_anonymized=False,
                    name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
                    email=candidate.get("email"),
                    phone=candidate.get("phone"),
                    linkedin_url=candidate.get("source_url"),
                )
            candidates.append(anonymized)

    return candidates


# =====================================================
# SSE Event Generator
# =====================================================


async def sse_event_generator(
    conversation_id: UUID, user_message: str, user_id: UUID
) -> AsyncGenerator[str, None]:
    """Generate SSE events for streaming agent response"""
    try:
        # Import here to avoid circular dependency
        from app.agents.sourcing_assistant import process_user_message

        # Yield thinking indicator
        thinking_event = StreamThinkingEvent(status="processing", message="Thinking...")
        yield f"event: thinking\ndata: {thinking_event.model_dump_json()}\n\n"

        # Process message with sourcing assistant agent
        async for event in process_user_message(conversation_id, user_message, user_id):
            event_type = event["type"]
            event_data = event["data"]

            if event_type == "message_chunk":
                chunk = StreamMessageChunk(text=event_data["text"])
                yield f"event: message_chunk\ndata: {chunk.model_dump_json()}\n\n"

            elif event_type == "candidates":
                # Get anonymized candidate data
                candidate_ids = event_data["candidate_ids"]
                anonymized = await get_anonymized_candidates(candidate_ids)

                candidates_event = StreamCandidatesEvent(
                    candidates=anonymized,
                    total_found=event_data.get("total_found", len(anonymized)),
                    showing_count=len(anonymized),
                    platforms=event_data.get("platforms", []),
                )
                yield f"event: candidates\ndata: {candidates_event.model_dump_json()}\n\n"

            elif event_type == "error":
                error_event = StreamErrorEvent(
                    error=event_data["error"],
                    message=event_data["message"],
                    retry_allowed=event_data.get("retry_allowed", True),
                )
                yield f"event: error\ndata: {error_event.model_dump_json()}\n\n"

        # Get the last message ID
        messages = await get_conversation_messages(conversation_id)
        last_message = messages[-1] if messages else None

        # Signal completion
        complete_event = StreamCompleteEvent(
            status="done",
            conversation_id=conversation_id,
            message_id=UUID(last_message["id"]) if last_message else conversation_id,
        )
        yield f"event: complete\ndata: {complete_event.model_dump_json()}\n\n"

    except Exception as e:
        error_event = StreamErrorEvent(
            error="processing_error",
            message=str(e),
            retry_allowed=True,
        )
        yield f"event: error\ndata: {error_event.model_dump_json()}\n\n"


# =====================================================
# API Endpoints
# =====================================================


@router.post("/start", response_model=ConversationResponse)
async def start_conversation(
    request: ConversationCreate,
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Start a new sourcing conversation.
    Returns greeting message and conversation ID.
    """
    # Create conversation record
    conversation = await create_conversation_record(user_id=UUID(user_id), job_id=request.job_id)

    # Save greeting message from assistant
    greeting = "Hi! I'll help you find great candidates. What role are you looking to fill?"
    await save_message(
        conversation_id=UUID(conversation["id"]),
        role=MessageRole.ASSISTANT,
        message_type=MessageType.TEXT,
        content=greeting,
    )

    # If initial message provided, save it
    if request.initial_message:
        await save_message(
            conversation_id=UUID(conversation["id"]),
            role=MessageRole.USER,
            message_type=MessageType.TEXT,
            content=request.initial_message,
        )

    return ConversationResponse(**conversation)


@router.get("/message")
async def send_message(
    conversation_id: UUID = Query(...),
    message: str = Query(...),
    user_id: str = Query("00000000-0000-0000-0000-000000000001"),
):
    """
    Send a message and stream agent response via Server-Sent Events.
    Returns SSE stream with events: thinking, message_chunk, candidates, complete, error
    """
    # Verify conversation belongs to user
    await get_conversation(conversation_id, UUID(user_id))

    # Save user message
    await save_message(
        conversation_id=conversation_id,
        role=MessageRole.USER,
        message_type=MessageType.TEXT,
        content=message,
    )

    # Return SSE stream
    return StreamingResponse(
        sse_event_generator(conversation_id, message, UUID(user_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("/reveal", response_model=RevealResponse)
async def reveal_candidate(
    request: RevealRequest,
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Reveal a candidate's identity and contact info.
    Charges credits and records in audit trail.
    """
    # Verify conversation belongs to user
    await get_conversation(request.conversation_id, UUID(user_id))

    # Call reveal function with credits
    result = supabase.rpc(
        "reveal_candidate_with_credits",
        {
            "p_candidate_id": str(request.candidate_id),
            "p_conversation_id": str(request.conversation_id),
            "p_user_id": user_id,
            "p_reveal_reason": request.reveal_reason,
            "p_credits_cost": 1,  # TODO: Make configurable
        },
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to reveal candidate")

    response_data = result.data

    if not response_data.get("success"):
        return RevealResponse(
            success=False,
            error=response_data.get("error", "unknown_error"),
            details=response_data.get("details"),
        )

    return RevealResponse(
        success=True,
        candidate=response_data.get("candidate"),
        credits_charged=response_data.get("credits_charged", 1),
        new_balance=response_data.get("new_balance", 0),
    )


@router.post("/create-job")
async def create_job_from_conversation(
    request: CreateJobRequest,
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Convert sourcing criteria from conversation into a formal job posting.
    """
    # Get conversation
    conversation = await get_conversation(request.conversation_id, UUID(user_id))

    # Extract criteria
    criteria_data = conversation.get("sourcing_criteria", {})
    criteria = SourcingCriteria(**criteria_data)

    # Transform to job data
    job_data = {
        "title": criteria.role or "Untitled Position",
        "user_id": user_id,
        "skills_matrix": {
            "required": [{"skill": s, "level": "intermediate"} for s in criteria.required_skills],
            "nice_to_have": [
                {"skill": s, "level": "intermediate"} for s in criteria.nice_to_have_skills
            ],
        },
        "location": criteria.location,
        "remote_policy": criteria.remote_policy or "remote_ok",
        "summary": f"Looking for {criteria.role} with {', '.join(criteria.required_skills[:3])}",
        "status": "active",
        "source": "chatbot_sourcing",
    }

    # Merge additional fields if provided
    if request.additional_fields:
        job_data.update(request.additional_fields)

    # Create job
    result = supabase.table("jobs").insert(job_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")

    job = result.data[0]

    # Link conversation to job
    await update_conversation(
        request.conversation_id, {"job_id": job["id"], "stage": ConversationStage.COMPLETED.value}
    )

    return job


@router.post("/add-to-job")
async def add_candidates_to_job(
    request: AddToJobRequest,
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Add revealed candidates to a job's application pipeline.
    Creates application records with 'sourced' status.
    """
    # Verify conversation belongs to user
    await get_conversation(request.conversation_id, UUID(user_id))

    # Verify candidates are revealed
    reveals_result = (
        supabase.table("candidate_reveals")
        .select("candidate_id")
        .eq("user_id", user_id)
        .eq("conversation_id", str(request.conversation_id))
        .in_("candidate_id", [str(cid) for cid in request.candidate_ids])
        .execute()
    )

    revealed_ids = {UUID(r["candidate_id"]) for r in (reveals_result.data or [])}

    if len(revealed_ids) != len(request.candidate_ids):
        missing = set(request.candidate_ids) - revealed_ids
        raise HTTPException(
            status_code=400,
            detail=f"Some candidates are not revealed: {[str(m) for m in missing]}",
        )

    # Create applications for each candidate
    applications = []

    for candidate_id in request.candidate_ids:
        # Get sourced candidate data
        sourced_result = (
            supabase.table("sourced_candidates").select("*").eq("id", str(candidate_id)).execute()
        )

        if not sourced_result.data:
            continue

        sourced = sourced_result.data[0]

        # Create or get formal candidate record
        candidate_data = {
            "name": sourced["name"],
            "email": sourced.get("email"),
            "phone": sourced.get("phone"),
            "linkedin_url": sourced.get("linkedin_url"),
            "resume_url": sourced.get("resume_url"),
            "skills": sourced.get("skills", []),
            "experience_years": sourced.get("experience_years"),
        }

        # Check if candidate already exists (by email)
        existing_candidate = None
        if candidate_data.get("email"):
            existing_result = (
                supabase.table("candidates")
                .select("id")
                .eq("email", candidate_data["email"])
                .execute()
            )
            if existing_result.data:
                existing_candidate = existing_result.data[0]

        if existing_candidate:
            candidate_id_final = existing_candidate["id"]
        else:
            # Create new candidate
            candidate_result = supabase.table("candidates").insert(candidate_data).execute()
            if not candidate_result.data:
                continue
            candidate_id_final = candidate_result.data[0]["id"]

        # Create application
        application_data = {
            "job_id": str(request.job_id),
            "candidate_id": candidate_id_final,
            "status": "sourced",
            "source": "chatbot_sourcing",
            "metadata": {
                "sourced_from_conversation": str(request.conversation_id),
                "sourced_candidate_id": str(candidate_id),
            },
        }

        app_result = supabase.table("applications").insert(application_data).execute()
        if app_result.data:
            applications.append(app_result.data[0])

    return {
        "success": True,
        "applications_created": len(applications),
        "applications": applications,
    }


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation_with_messages(
    conversation_id: UUID,
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Get full conversation with all messages.
    """
    conversation = await get_conversation(conversation_id, UUID(user_id))
    messages = await get_conversation_messages(conversation_id)

    return ConversationWithMessages(
        conversation=ConversationResponse(**conversation),
        messages=[MessageResponse(**msg) for msg in messages],
    )


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    status: str | None = Query(None, description="Filter by stage"),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    List user's conversations.
    """
    query = (
        supabase.table("sourcing_conversations")
        .select("*")
        .eq("user_id", user_id)
        .order("last_activity_at", desc=True)
        .limit(limit)
        .offset(offset)
    )

    if status:
        query = query.eq("stage", status)

    result = await query.execute()

    return [ConversationResponse(**conv) for conv in (result.data or [])]
