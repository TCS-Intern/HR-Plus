"""
Sourcing Assistant Agent - Conversational candidate sourcing with Google ADK
Handles multi-turn conversation, criteria extraction, and candidate search orchestration
"""

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

from google.genai import Client
from google.genai.types import GenerateContentConfig, Tool

from app.config import settings
from app.services.supabase import supabase

# =====================================================
# Agent Configuration
# =====================================================

AGENT_MODEL = settings.gemini_model  # Use model from .env

AGENT_SYSTEM_INSTRUCTION = """You are a friendly, expert talent sourcing assistant helping recruiters find the best candidates.

**CRITICAL OUTPUT RULES:**
- NEVER output code blocks, tool_code, ```python```, or any programming syntax
- NEVER show internal reasoning, comments, or thinking process
- ONLY output natural conversational text that a human recruiter would say
- Keep responses concise and friendly (1-3 sentences max)

**Your Goals:**
1. Have a natural, conversational dialogue to understand hiring needs
2. Gather: role, skills, experience years, location, remote policy
3. When user confirms, say you'll search for candidates

**Conversation Flow:**
1. Ask what role they're hiring for
2. Ask about required skills (3-5 core skills)
3. Ask about years of experience (parse numbers carefully - "5" means 5, not 55)
4. Ask about location/remote preferences
5. Summarize criteria and ask "Should I start searching?"

**Important:**
- Ask ONE question at a time
- Parse user input carefully - if they say "5", that means 5 years, not 55
- Be conversational and brief
- When user says "yes" or "search", confirm you're searching

**Example responses:**
- "Great! What skills are most important for this role?"
- "Got it - 5 years of experience. Any location preferences, or is remote OK?"
- "Perfect! So you need an AI Engineer with Python and LangChain, 5+ years experience, remote. Should I start searching?"
"""


# =====================================================
# Tool Functions
# =====================================================


async def get_conversation_context(conversation_id: str) -> dict[str, Any]:
    """
    Fetch conversation history, stage, and criteria for agent context.

    Args:
        conversation_id: UUID of the conversation

    Returns:
        Dict with conversation state, messages, and extracted criteria
    """
    # Get conversation
    conv_result = (
        supabase.table("sourcing_conversations").select("*").eq("id", conversation_id).execute()
    )

    if not conv_result.data:
        return {"error": "Conversation not found"}

    conversation = conv_result.data[0]

    # Get messages
    msg_result = (
        supabase.table("sourcing_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )

    messages = msg_result.data or []

    return {
        "conversation_id": conversation_id,
        "stage": conversation["stage"],
        "sourcing_criteria": conversation.get("sourcing_criteria", {}),
        "thought_signature": conversation.get("thought_signature", {}),
        "candidates_found_count": conversation.get("candidates_found_count", 0),
        "message_history": [
            {"role": msg["role"], "content": msg.get("content", "")}
            for msg in messages
            if msg["message_type"] == "text"
        ],
    }


async def extract_criteria(message: str, current_criteria: dict[str, Any]) -> dict[str, Any]:
    """
    Extract and merge sourcing criteria from user message.
    Uses LLM to intelligently parse user input and update criteria.

    Args:
        message: User's message
        current_criteria: Current sourcing criteria dict

    Returns:
        Updated criteria dict
    """
    # Use a simple LLM call to extract structured criteria
    client = Client()

    extraction_prompt = f"""Extract hiring criteria from this message and merge with existing criteria.

USER MESSAGE: "{message}"

CURRENT CRITERIA: {json.dumps(current_criteria, indent=2)}

Extract the following fields if mentioned (keep existing if not mentioned):
- role: Job title/role
- required_skills: List of must-have skills
- nice_to_have_skills: List of nice-to-have skills
- experience_years_min: Minimum years of experience
- experience_years_max: Maximum years of experience
- location: Location (city/region)
- remote_policy: "remote_only", "hybrid", "onsite", or "remote_ok"
- company_size: Company size preference
- industry: Industry preference
- salary_min: Minimum salary
- salary_max: Maximum salary
- education: Education requirement

Return ONLY a JSON object with updated criteria. Merge new info with existing criteria.
"""

    try:
        response = client.models.generate_content(
            model=AGENT_MODEL,
            contents=extraction_prompt,
            config=GenerateContentConfig(
                temperature=0.1,  # Low temp for consistent extraction
                response_mime_type="application/json",
            ),
        )

        extracted = json.loads(response.text)

        # Merge with current criteria
        merged = {**current_criteria, **extracted}

        # Clean up None values
        return {k: v for k, v in merged.items() if v is not None}

    except Exception as e:
        print(f"Error extracting criteria: {e}")
        return current_criteria


def _location_matches(candidate_location: str, target_location: str) -> bool:
    """
    Check if a candidate's location reasonably matches the target location.
    Uses case-insensitive substring matching with common location synonyms.

    Args:
        candidate_location: Location string from the candidate profile
        target_location: Location the user requested

    Returns:
        True if the locations are a reasonable match
    """
    if not target_location or not candidate_location:
        return True  # No filter = match everything

    candidate_loc = candidate_location.lower().strip()
    target_loc = target_location.lower().strip()

    # Direct substring match either way
    if target_loc in candidate_loc or candidate_loc in target_loc:
        return True

    # Split into parts and check overlap (e.g., "Toulouse" in "Toulouse, France")
    target_parts = [p.strip() for p in target_loc.replace(",", " ").split() if len(p.strip()) > 2]
    candidate_parts = [p.strip() for p in candidate_loc.replace(",", " ").split() if len(p.strip()) > 2]

    for tp in target_parts:
        for cp in candidate_parts:
            if tp in cp or cp in tp:
                return True

    return False


async def _search_with_proxycurl(
    job_titles: list[str] | None,
    skills: list[str],
    locations: list[str] | None,
    limit: int,
) -> dict[str, Any]:
    """Search candidates using Proxycurl (best location filtering)."""
    from app.services.proxycurl import proxycurl

    if not proxycurl.is_configured:
        return {"status": "not_configured"}

    response = await proxycurl.search_people(
        job_titles=job_titles,
        skills=skills,
        locations=locations,
        limit=limit,
    )
    return response


async def _search_with_apollo(
    job_titles: list[str] | None,
    skills: list[str],
    locations: list[str] | None,
    limit: int,
) -> dict[str, Any]:
    """Search candidates using Apollo.io."""
    from app.services.apollo import apollo

    if not apollo.api_key:
        return {"status": "not_configured"}

    response = await apollo.search_people(
        job_titles=job_titles,
        skills=skills,
        locations=locations,
        per_page=min(limit, 25),
    )
    return response


async def _search_with_apify(
    job_titles: list[str] | None,
    skills: list[str],
    locations: list[str] | None,
    keywords: str | None,
    limit: int,
) -> dict[str, Any]:
    """Search candidates using Apify (HarvestAPI LinkedIn scraper)."""
    from app.services.apify import apify

    if not apify.api_token:
        return {"status": "not_configured"}

    response = await apify.search_linkedin_people(
        job_titles=job_titles,
        skills=skills,
        locations=locations,
        keywords=keywords,
        limit=limit,
    )
    return response


def _calculate_fit_score(candidate: dict[str, Any], criteria: dict[str, Any]) -> float:
    """Calculate a 0-1 fit score based on how well a candidate matches search criteria.

    Weights: skills match (40%), title match (30%), location match (20%), experience (10%).
    """
    score = 0.0

    # Skills match (40%)
    required_skills = [s.lower() for s in criteria.get("required_skills", [])]
    candidate_skills = [s.lower() for s in (candidate.get("skills") or [])]
    candidate_text = " ".join([
        candidate.get("headline", ""),
        candidate.get("title", ""),
        candidate.get("summary", ""),
    ]).lower()

    if required_skills:
        matched = sum(
            1 for skill in required_skills
            if any(skill in cs for cs in candidate_skills) or skill in candidate_text
        )
        score += 0.4 * (matched / len(required_skills))
    else:
        score += 0.4  # No skill requirements = full score

    # Title match (30%)
    target_role = criteria.get("role", "").lower()
    candidate_title = (candidate.get("title") or "").lower()
    if target_role and candidate_title:
        role_words = target_role.split()
        title_matched = sum(1 for w in role_words if w in candidate_title)
        score += 0.3 * (title_matched / len(role_words)) if role_words else 0.3
    elif not target_role:
        score += 0.3

    # Location match (20%)
    target_location = criteria.get("location", "").lower()
    candidate_location = (candidate.get("location") or "").lower()
    if target_location and candidate_location:
        loc_words = [w for w in target_location.split(",")[0].split() if len(w) > 2]
        if any(w in candidate_location for w in loc_words):
            score += 0.2
        else:
            score += 0.05  # Partial credit for having a location
    elif not target_location:
        score += 0.2

    # Experience match (10%)
    min_exp = criteria.get("min_experience_years", 0)
    candidate_exp = candidate.get("experience_years") or 0
    if min_exp and candidate_exp:
        score += 0.1 * min(candidate_exp / max(min_exp, 1), 1.0)
    else:
        score += 0.1

    return round(min(score, 1.0), 2)


async def search_candidates(
    criteria: dict[str, Any], conversation_id: str, max_results: int = 20
) -> dict[str, Any]:
    """
    Search for candidates across platforms using available providers.
    Tries Proxycurl -> Apollo -> Apify in order of availability.

    Args:
        criteria: Sourcing criteria dict
        conversation_id: Conversation ID to link candidates to
        max_results: Maximum candidates to return

    Returns:
        Dict with candidate_ids, total_found, and search metadata
    """
    try:
        # Build search parameters from criteria
        job_titles = [criteria["role"]] if criteria.get("role") else None
        skills = criteria.get("required_skills", [])
        locations = [criteria["location"]] if criteria.get("location") else None
        target_location = criteria.get("location", "")
        keywords = " ".join(skills[:5]) if skills else None
        fetch_limit = max_results * 2  # Fetch extra for location filtering

        # Try providers in cascade: Proxycurl -> Apollo -> Apify
        # Each provider is tried if we still need more candidates
        # Apify is ALWAYS tried as final fallback if earlier providers failed/errored
        all_candidates: list[dict[str, Any]] = []
        platforms_used: list[str] = []
        errors: list[str] = []
        not_configured: list[str] = []
        had_errors = False

        # 1. Proxycurl (best structured location filtering)
        proxycurl_resp = await _search_with_proxycurl(job_titles, skills, locations, fetch_limit)
        if proxycurl_resp.get("status") == "success" and proxycurl_resp.get("people"):
            all_candidates.extend(proxycurl_resp["people"])
            platforms_used.append("proxycurl")
            print(f"Proxycurl returned {len(proxycurl_resp['people'])} candidates")
        elif proxycurl_resp.get("status") == "not_configured":
            not_configured.append("Proxycurl (PROXYCURL_API_KEY)")
        elif proxycurl_resp.get("status") == "error":
            errors.append(f"Proxycurl: {proxycurl_resp.get('message', 'unknown error')}")
            had_errors = True
            print(f"Proxycurl error: {proxycurl_resp.get('message')}")

        # 2. Apollo.io (good structured filtering)
        if len(all_candidates) < max_results:
            apollo_resp = await _search_with_apollo(job_titles, skills, locations, fetch_limit)
            if apollo_resp.get("status") == "success" and apollo_resp.get("people"):
                all_candidates.extend(apollo_resp["people"])
                platforms_used.append("apollo")
                print(f"Apollo returned {len(apollo_resp['people'])} candidates")
            elif apollo_resp.get("status") == "not_configured":
                not_configured.append("Apollo (APOLLO_API_KEY)")
            elif apollo_resp.get("status") == "error":
                errors.append(f"Apollo: {apollo_resp.get('message', 'unknown error')}")
                had_errors = True
                print(f"Apollo error: {apollo_resp.get('message')}")

        # 3. Apify (fallback) - always try if we need more candidates OR if earlier providers errored
        if len(all_candidates) < max_results or had_errors:
            apify_resp = await _search_with_apify(
                job_titles, skills, locations, keywords, fetch_limit
            )
            if apify_resp.get("status") == "success" and apify_resp.get("people"):
                all_candidates.extend(apify_resp["people"])
                platforms_used.append("apify")
                print(f"Apify returned {len(apify_resp['people'])} candidates")
            elif apify_resp.get("status") == "not_configured":
                not_configured.append("Apify (APIFY_API_TOKEN)")
            elif apify_resp.get("status") == "error":
                errors.append(f"Apify: {apify_resp.get('message', 'unknown error')}")
                print(f"Apify error: {apify_resp.get('message')}")

        # If no providers returned candidates
        if not platforms_used and not all_candidates:
            parts = []
            if errors:
                parts.append(f"Errors: {'; '.join(errors)}")
            if not_configured:
                parts.append(f"Not configured: {', '.join(not_configured)}")
            detail = " | ".join(parts) if parts else "No providers available."
            return {
                "success": False,
                "error": f"No sourcing providers returned results. {detail}",
                "candidate_ids": [],
                "total_found": 0,
            }

        # Filter candidates by location if a target location was specified
        if target_location and all_candidates:
            filtered = [
                c for c in all_candidates
                if _location_matches(c.get("location", ""), target_location)
            ]
            print(
                f"Location filter '{target_location}': {len(all_candidates)} -> {len(filtered)} candidates"
            )
            all_candidates = filtered

        if not all_candidates:
            return {
                "success": True,
                "candidate_ids": [],
                "total_found": 0,
                "platforms": platforms_used,
                "search_query": f"{job_titles} {keywords}".strip()
                if job_titles or keywords
                else "general",
                "message": f"No candidates found matching your criteria"
                + (f" in {target_location}" if target_location else "")
                + ". Try broadening your search.",
            }

        # Get or create default company for chatbot sourcing
        company_result = (
            supabase.table("companies")
            .select("id")
            .eq("name", "Chatbot Sourcing")
            .limit(1)
            .execute()
        )
        if company_result.data:
            company_id = company_result.data[0]["id"]
        else:
            # Create default company for chatbot sourcing
            new_company = (
                supabase.table("companies")
                .insert(
                    {
                        "name": "Chatbot Sourcing",
                        "tier": "self_serve",
                    }
                )
                .execute()
            )
            company_id = new_company.data[0]["id"] if new_company.data else None

        if not company_id:
            return {
                "success": False,
                "error": "Failed to create company for sourcing",
                "candidate_ids": [],
                "total_found": 0,
            }

        # Save candidates to database
        candidate_ids = []

        for candidate in all_candidates[:max_results]:
            # Parse name into first/last
            full_name = candidate.get("name", "Unknown")
            name_parts = full_name.split(" ", 1)
            first_name = candidate.get("first_name") or name_parts[0]
            last_name = candidate.get("last_name") or (name_parts[1] if len(name_parts) > 1 else "")

            # Create sourced_candidate record matching actual schema
            candidate_data = {
                "company_id": company_id,
                "first_name": first_name,
                "last_name": last_name,
                "email": candidate.get("email"),
                "phone": candidate.get("phone"),
                "source_url": candidate.get("profile_url"),
                "current_title": candidate.get("title"),
                "current_company": candidate.get("company"),
                "location": candidate.get("location"),
                "experience_years": candidate.get("experience_years"),
                "skills": candidate.get("skills", []),
                "summary": candidate.get("summary") or candidate.get("headline"),
                "headline": candidate.get("headline"),
                "fit_score": _calculate_fit_score(candidate, criteria),
                "source": candidate.get("platform", "linkedin"),
                "status": "new",
                "is_anonymized": True,
                "revealed_in_conversation": conversation_id,
            }

            result = supabase.table("sourced_candidates").insert(candidate_data).execute()

            if result.data:
                candidate_ids.append(result.data[0]["id"])

        # Update conversation
        supabase.table("sourcing_conversations").update(
            {
                "candidates_found_count": len(candidate_ids),
                "stage": "presenting_results",
            }
        ).eq("id", conversation_id).execute()

        return {
            "success": True,
            "candidate_ids": candidate_ids,
            "total_found": len(candidate_ids),
            "platforms": platforms_used or ["linkedin"],
            "search_query": f"{job_titles} {keywords}".strip()
            if job_titles or keywords
            else "general",
        }

    except Exception as e:
        print(f"Error searching candidates: {e}")
        return {
            "success": False,
            "error": str(e),
            "candidate_ids": [],
            "total_found": 0,
        }


# =====================================================
# Define Tools for Agent
# =====================================================

# Convert async functions to Tool objects for Google ADK
tools = [
    Tool(
        function_declarations=[
            {
                "name": "get_conversation_context",
                "description": "Fetch conversation history, stage, and criteria for context",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "conversation_id": {
                            "type": "string",
                            "description": "UUID of the conversation",
                        }
                    },
                    "required": ["conversation_id"],
                },
            },
            {
                "name": "extract_criteria",
                "description": "Extract and merge sourcing criteria from user message",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "User's message to extract criteria from",
                        },
                        "current_criteria": {
                            "type": "object",
                            "description": "Current sourcing criteria",
                        },
                    },
                    "required": ["message", "current_criteria"],
                },
            },
            {
                "name": "search_candidates",
                "description": "Search for candidates across LinkedIn, GitHub, and Indeed",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "criteria": {
                            "type": "object",
                            "description": "Sourcing criteria with role, skills, experience, location",
                        },
                        "conversation_id": {
                            "type": "string",
                            "description": "Conversation ID to link candidates to",
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of candidates to return (default 20)",
                            "default": 20,
                        },
                    },
                    "required": ["criteria", "conversation_id"],
                },
            },
        ]
    )
]


# =====================================================
# Main Agent Processing Function
# =====================================================


async def process_user_message(
    conversation_id: UUID, user_message: str, user_id: UUID
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Process user message with sourcing assistant agent and stream response.
    Supports multi-turn tool calling.

    Args:
        conversation_id: UUID of the conversation
        user_message: User's message
        user_id: User ID

    Yields:
        Dict events: {"type": "message_chunk"|"candidates"|"error", "data": {...}}
    """
    try:
        # Get conversation context
        context = await get_conversation_context(str(conversation_id))

        # Initialize Gemini client with API key
        client = Client(api_key=settings.google_api_key)

        # Build conversation history for agent
        history = context.get("message_history", [])

        # Convert to Gemini format
        contents = []
        for msg in history[-10:]:  # Last 10 messages for context window
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        # Add current user message
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        # Update conversation stage if needed
        current_stage = context.get("stage", "greeting")
        if current_stage == "greeting" and len(history) > 0:
            supabase.table("sourcing_conversations").update({"stage": "requirements_gathering"}).eq(
                "id", str(conversation_id)
            ).execute()

        # Check if user is confirming search (simple keyword detection)
        search_keywords = ["yes", "search", "find", "go ahead", "please search", "start searching"]
        user_wants_search = any(kw in user_message.lower() for kw in search_keywords)
        has_criteria = bool(
            context.get("sourcing_criteria", {}).get("role")
            or context.get("sourcing_criteria", {}).get("required_skills")
        )

        # If user confirms and we have criteria, trigger search directly
        if (
            user_wants_search
            and has_criteria
            and current_stage in ["requirements_gathering", "confirmation"]
        ):
            yield {"type": "thinking", "data": {"message": "Searching for candidates..."}}

            search_result = await search_candidates(
                context.get("sourcing_criteria", {}),
                str(conversation_id),
                20,
            )

            if search_result.get("success") and search_result.get("candidate_ids"):
                yield {
                    "type": "candidates",
                    "data": {
                        "candidate_ids": search_result["candidate_ids"],
                        "total_found": search_result["total_found"],
                        "platforms": search_result.get("platforms", []),
                    },
                }
                # Generate a response about the results
                yield {
                    "type": "message_chunk",
                    "data": {
                        "text": f"I found {search_result['total_found']} candidates matching your criteria. Here are the top results!"
                    },
                }

                # Save response
                supabase.table("sourcing_messages").insert(
                    {
                        "conversation_id": str(conversation_id),
                        "role": "assistant",
                        "message_type": "text",
                        "content": f"I found {search_result['total_found']} candidates matching your criteria. Here are the top results!",
                    }
                ).execute()
                return
            elif search_result.get("success") and not search_result.get("candidate_ids"):
                # Search succeeded but no matching candidates
                no_results_msg = search_result.get(
                    "message",
                    "I couldn't find candidates matching all your criteria. Try broadening your location or skills requirements.",
                )
                yield {
                    "type": "message_chunk",
                    "data": {"text": no_results_msg},
                }
                supabase.table("sourcing_messages").insert(
                    {
                        "conversation_id": str(conversation_id),
                        "role": "assistant",
                        "message_type": "text",
                        "content": no_results_msg,
                    }
                ).execute()
                return
            elif not search_result.get("success"):
                yield {
                    "type": "error",
                    "data": {
                        "error": "search_failed",
                        "message": search_result.get("error", "Search failed"),
                    },
                }

        response_text = ""

        # Helper to run sync streaming in thread
        import queue
        from concurrent.futures import ThreadPoolExecutor

        async def stream_response(call_contents):
            """Stream response from model"""
            nonlocal response_text

            chunk_queue: queue.Queue = queue.Queue()

            def stream_in_thread():
                try:
                    # Simple streaming without tools - let the conversation flow naturally
                    for chunk in client.models.generate_content_stream(
                        model=AGENT_MODEL,
                        contents=call_contents,
                        config=GenerateContentConfig(
                            system_instruction=AGENT_SYSTEM_INSTRUCTION,
                            temperature=0.7,
                        ),
                    ):
                        chunk_queue.put(("chunk", chunk))
                    chunk_queue.put(("done", None))
                except Exception as e:
                    chunk_queue.put(("error", e))

            executor = ThreadPoolExecutor(max_workers=1)
            executor.submit(stream_in_thread)

            while True:
                try:
                    item_type, item = chunk_queue.get(timeout=0.1)
                except queue.Empty:
                    await asyncio.sleep(0.01)
                    continue

                if item_type == "done":
                    break
                elif item_type == "error":
                    raise item

                chunk = item

                # Handle text chunks only
                if hasattr(chunk, "text") and chunk.text:
                    response_text += chunk.text
                    yield {"type": "message_chunk", "data": {"text": chunk.text}}

            executor.shutdown(wait=False)

        # Extract criteria from user message in background
        current_criteria = context.get("sourcing_criteria", {})
        updated_criteria = await extract_criteria(user_message, current_criteria)
        if updated_criteria != current_criteria:
            supabase.table("sourcing_conversations").update(
                {"sourcing_criteria": updated_criteria}
            ).eq("id", str(conversation_id)).execute()

        # Stream the response
        async for event in stream_response(contents):
            yield event

        # Save assistant response to database
        if response_text:
            supabase.table("sourcing_messages").insert(
                {
                    "conversation_id": str(conversation_id),
                    "role": "assistant",
                    "message_type": "text",
                    "content": response_text,
                }
            ).execute()

    except Exception as e:
        print(f"Error in process_user_message: {e}")
        yield {
            "type": "error",
            "data": {
                "error": "processing_error",
                "message": str(e),
                "retry_allowed": True,
            },
        }
