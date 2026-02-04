"""
API endpoints for chatbot-based candidate sourcing with SSE streaming
"""

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Form, Header, HTTPException, Query, UploadFile
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

    result = query.execute()

    return [ConversationResponse(**conv) for conv in (result.data or [])]


# =====================================================
# Multi-Modal Input Endpoints
# =====================================================


@router.post("/upload")
async def upload_document(
    file: UploadFile,
    conversation_id: str = Form(...),
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Upload and analyze a document (JD, resume, or CSV).
    Extracts job requirements or candidate info using AI.
    """
    import io

    from google.genai import Client

    from app.config import settings

    # Verify conversation belongs to user
    await get_conversation(UUID(conversation_id), UUID(user_id))

    # Read file content
    content = await file.read()
    filename = file.filename or "document"

    # Determine file type
    file_type = "unknown"
    extracted_text = ""

    if filename.lower().endswith(".pdf"):
        file_type = "pdf"
        # Extract text from PDF
        from pypdf import PdfReader

        pdf_reader = PdfReader(io.BytesIO(content))
        extracted_text = "\n".join(page.extract_text() or "" for page in pdf_reader.pages)

    elif filename.lower().endswith((".doc", ".docx")):
        file_type = "docx"
        # Extract text from Word document
        from docx import Document

        doc = Document(io.BytesIO(content))
        extracted_text = "\n".join(para.text for para in doc.paragraphs)

    elif filename.lower().endswith(".csv"):
        file_type = "csv"
        # Read CSV content
        extracted_text = content.decode("utf-8", errors="ignore")

    # Use AI to extract criteria from the document
    client = Client(api_key=settings.google_api_key)

    extraction_prompt = f"""Analyze this document and extract job requirements or candidate information.

DOCUMENT TYPE: {file_type}
FILENAME: {filename}

DOCUMENT CONTENT:
{extracted_text[:10000]}  # Limit to first 10k chars

Extract the following if this is a job description:
- Job title/role
- Required skills (list)
- Nice-to-have skills (list)
- Years of experience required
- Location requirements
- Remote policy
- Salary range (if mentioned)

If this is a resume or candidate list, extract:
- Candidate names
- Skills
- Experience levels
- Current roles/companies

Return a JSON object with the extracted information and a natural language summary.
"""

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=extraction_prompt,
            config={"response_mime_type": "application/json"},
        )

        import json

        extracted_data = json.loads(response.text)

        # Update conversation criteria if job requirements found
        if extracted_data.get("role") or extracted_data.get("required_skills"):
            current_conv = await get_conversation(UUID(conversation_id), UUID(user_id))
            current_criteria = current_conv.get("sourcing_criteria", {})

            # Merge extracted data with current criteria
            updated_criteria = {**current_criteria}
            if extracted_data.get("role"):
                updated_criteria["role"] = extracted_data["role"]
            if extracted_data.get("required_skills"):
                updated_criteria["required_skills"] = extracted_data["required_skills"]
            if extracted_data.get("nice_to_have_skills"):
                updated_criteria["nice_to_have_skills"] = extracted_data["nice_to_have_skills"]
            if extracted_data.get("experience_years"):
                updated_criteria["experience_years_min"] = extracted_data["experience_years"]
            if extracted_data.get("location"):
                updated_criteria["location"] = extracted_data["location"]

            await update_conversation(UUID(conversation_id), {"sourcing_criteria": updated_criteria})

        # Generate response message
        summary = extracted_data.get("summary", "")
        if not summary:
            if file_type == "csv":
                summary = "I've analyzed the CSV file with candidate data."
            else:
                summary = f"I've extracted the key requirements from {filename}."

        return {
            "success": True,
            "file_type": file_type,
            "extracted_criteria": extracted_data,
            "message": summary,
        }

    except Exception as e:
        print(f"Error extracting from document: {e}")
        return {
            "success": False,
            "file_type": file_type,
            "message": f"I received {filename} but had trouble extracting details. Could you describe the key requirements?",
            "error": str(e),
        }


@router.post("/extract-url")
async def extract_from_url(
    url: str = Form(...),
    conversation_id: str = Form(...),
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Extract job requirements from a URL (job posting page).
    Uses AI to parse the page content and extract skills/requirements.
    """
    import httpx
    from google.genai import Client

    from app.config import settings

    # Verify conversation belongs to user
    await get_conversation(UUID(conversation_id), UUID(user_id))

    # Fetch the URL content
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.text
    except Exception as e:
        return {
            "success": False,
            "error": "fetch_failed",
            "message": f"Could not fetch the URL. Please check if it's accessible. Error: {str(e)}",
        }

    # Use AI to extract job requirements from HTML
    ai_client = Client(api_key=settings.google_api_key)

    extraction_prompt = f"""Extract job posting information from this webpage content.

URL: {url}

PAGE CONTENT (HTML):
{html_content[:15000]}  # Limit content

Extract:
1. Job title
2. Company name
3. Location
4. Required skills (as a list)
5. Nice-to-have skills (as a list)
6. Years of experience required
7. Remote policy (remote, hybrid, onsite)
8. Salary range (if mentioned)
9. Key responsibilities (brief list)

Return a JSON object with these fields. Be thorough in extracting skills - look for both explicit requirements and implied skills from responsibilities.
"""

    try:
        ai_response = ai_client.models.generate_content(
            model=settings.gemini_model,
            contents=extraction_prompt,
            config={"response_mime_type": "application/json"},
        )

        import json

        extracted_data = json.loads(ai_response.text)

        # Update conversation criteria
        current_conv = await get_conversation(UUID(conversation_id), UUID(user_id))
        current_criteria = current_conv.get("sourcing_criteria", {})

        updated_criteria = {**current_criteria}
        if extracted_data.get("title"):
            updated_criteria["role"] = extracted_data["title"]
        if extracted_data.get("required_skills"):
            updated_criteria["required_skills"] = extracted_data["required_skills"]
        if extracted_data.get("nice_to_have_skills"):
            updated_criteria["nice_to_have_skills"] = extracted_data["nice_to_have_skills"]
        if extracted_data.get("experience_years"):
            updated_criteria["experience_years_min"] = extracted_data["experience_years"]
        if extracted_data.get("location"):
            updated_criteria["location"] = extracted_data["location"]
        if extracted_data.get("remote_policy"):
            updated_criteria["remote_policy"] = extracted_data["remote_policy"]

        await update_conversation(UUID(conversation_id), {"sourcing_criteria": updated_criteria})

        # Build response
        skills = extracted_data.get("required_skills", [])
        title = extracted_data.get("title", "the position")
        company = extracted_data.get("company", "")

        message = f"I've analyzed the job posting for **{title}**"
        if company:
            message += f" at {company}"
        message += ".\n\n"

        if skills:
            message += "**Key Skills Required:**\n"
            for skill in skills[:10]:
                message += f"• {skill}\n"

        if extracted_data.get("experience_years"):
            message += f"\n**Experience:** {extracted_data['experience_years']}+ years"

        if extracted_data.get("location"):
            message += f"\n**Location:** {extracted_data['location']}"

        message += "\n\nWould you like me to search for candidates with these skills?"

        return {
            "success": True,
            "title": extracted_data.get("title"),
            "company": extracted_data.get("company"),
            "skills": skills,
            "nice_to_have_skills": extracted_data.get("nice_to_have_skills", []),
            "experience_years": extracted_data.get("experience_years"),
            "location": extracted_data.get("location"),
            "remote_policy": extracted_data.get("remote_policy"),
            "message": message,
        }

    except Exception as e:
        print(f"Error extracting from URL: {e}")
        return {
            "success": False,
            "message": "I had trouble parsing the job posting. Could you paste the key requirements directly?",
            "error": str(e),
        }


@router.post("/generate-outreach")
async def generate_outreach_message(
    candidate_id: str = Form(...),
    conversation_id: str = Form(...),
    user_id: str = Header("00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
):
    """
    Generate a personalized outreach message for a revealed candidate.
    Uses AI to create a compelling, professional message.
    """
    from google.genai import Client

    from app.config import settings

    # Verify conversation belongs to user
    conversation = await get_conversation(UUID(conversation_id), UUID(user_id))

    # Get candidate data
    candidate_result = (
        supabase.table("sourced_candidates").select("*").eq("id", candidate_id).execute()
    )

    if not candidate_result.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate = candidate_result.data[0]
    criteria = conversation.get("sourcing_criteria", {})

    # Build prompt for outreach generation
    client = Client(api_key=settings.google_api_key)

    outreach_prompt = f"""Generate a personalized, professional outreach message for recruiting this candidate.

CANDIDATE INFO:
- Name: {candidate.get('first_name', '')} {candidate.get('last_name', '')}
- Current Role: {candidate.get('current_title', 'Professional')}
- Company: {candidate.get('current_company', '')}
- Skills: {', '.join(candidate.get('skills', [])[:5])}
- Experience: {candidate.get('experience_years', 'Several')} years
- Location: {candidate.get('location', '')}

JOB WE'RE HIRING FOR:
- Role: {criteria.get('role', 'an exciting opportunity')}
- Required Skills: {', '.join(criteria.get('required_skills', [])[:5])}
- Location: {criteria.get('location', 'Flexible')}

GUIDELINES:
1. Keep it concise (150-200 words)
2. Personalize by mentioning their specific skills/experience
3. Be professional but warm
4. Include a clear call-to-action
5. Don't be overly salesy
6. Don't make up specific details about the role/company

Return ONLY the message text, no JSON or formatting.
"""

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=outreach_prompt,
            config={"temperature": 0.7},
        )

        return {
            "success": True,
            "message": response.text.strip(),
            "candidate_name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
        }

    except Exception as e:
        print(f"Error generating outreach: {e}")

        # Fallback message
        first_name = candidate.get("first_name", "there")
        role = candidate.get("current_title", "your role")
        skills = candidate.get("skills", [])[:3]

        fallback = f"""Hi {first_name},

I came across your profile and was impressed by your experience as a {role}. Your background in {', '.join(skills) if skills else 'your field'} particularly caught my attention.

We're currently looking for talented professionals for an exciting opportunity, and I believe your skills would be a great fit.

Would you be open to a brief conversation to learn more? I'd love to share details about the role and hear about your career goals.

Looking forward to connecting!

Best regards"""

        return {
            "success": True,
            "message": fallback,
            "candidate_name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
            "is_fallback": True,
        }
