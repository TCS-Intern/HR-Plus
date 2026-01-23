"""
Sourcing Assistant Agent - Conversational candidate sourcing with Google ADK
Handles multi-turn conversation, criteria extraction, and candidate search orchestration
"""

import asyncio
import json
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import UUID

from google.genai import Client
from google.genai.types import GenerateContentConfig, Tool

from app.services.supabase import supabase


# =====================================================
# Agent Configuration
# =====================================================

AGENT_MODEL = "gemini-2.0-flash-exp"  # Fast model for conversation

AGENT_SYSTEM_INSTRUCTION = """You are a friendly, expert talent sourcing assistant helping recruiters find the best candidates.

**Your Goals:**
1. Have a natural, conversational dialogue to understand hiring needs
2. Extract structured sourcing criteria (role, skills, experience, location, etc.)
3. Search for candidates across platforms (LinkedIn, GitHub, Indeed)
4. Present anonymized candidate profiles ranked by fit

**Conversation Guidelines:**
- Ask ONE question at a time (proven best practice for conversions)
- Be conversational, not robotic or interrogative
- Extract information as you go, don't wait until the end
- Track context in your thought signature to stay consistent across turns
- NEVER reveal candidate names, emails, or contact info in conversation
- Refer to candidates as "Candidate A", "Senior Engineer #1234", etc.

**Conversation Flow:**
1. **Greeting**: Welcome user, ask what role they're hiring for
2. **Requirements Gathering**: Ask systematically:
   - Role/title clarity (if vague, help refine)
   - Required skills (3-5 core skills)
   - Experience level (years)
   - Location preferences
   - Remote policy (remote-only, hybrid, onsite, remote-ok)
   - Optional: company size, industry, education, salary range
3. **Confirmation**: Summarize all criteria in bullet points, ask "Should I start searching?"
4. **Sourcing**: Call search_candidates tool, show progress
5. **Presenting Results**: Present top candidates as anonymized cards
6. **Refinement**: Handle feedback like "show more senior", "filter by Python experts"

**Important Rules:**
- Extract criteria incrementally as user provides information
- Update thought_signature with new beliefs and context
- Check previous thought_signature before asking questions (don't repeat)
- Be consistent - don't contradict yourself across turns
- If user gives multiple pieces of info at once, extract all of them
- Example: "Senior React Developer in SF" → role="Senior Developer", skills=["React"], location="San Francisco"

**Tool Usage:**
- Use extract_criteria after each user message to update sourcing_criteria
- Use search_candidates when criteria is complete and user confirms
- Use get_conversation_context at the start of each turn for full context

**Anonymization:**
- In conversation, ALWAYS mask candidate names
- Use patterns like: "Candidate #1234", "Senior Backend Engineer A", "Profile #5678"
- Never say real names like "John Smith" or "jane.doe@company.com"
- The UI will handle showing anonymized cards with "Reveal" buttons
"""


# =====================================================
# Tool Functions
# =====================================================


async def get_conversation_context(conversation_id: str) -> Dict[str, Any]:
    """
    Fetch conversation history, stage, and criteria for agent context.

    Args:
        conversation_id: UUID of the conversation

    Returns:
        Dict with conversation state, messages, and extracted criteria
    """
    # Get conversation
    conv_result = (
        supabase.table("sourcing_conversations")
        .select("*")
        .eq("id", conversation_id)
        .execute()
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


async def extract_criteria(message: str, current_criteria: Dict[str, Any]) -> Dict[str, Any]:
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


async def search_candidates(
    criteria: Dict[str, Any], conversation_id: str, max_results: int = 20
) -> Dict[str, Any]:
    """
    Search for candidates across platforms (LinkedIn, GitHub, Indeed).
    Reuses existing sourcing logic from app/services/apify.py.

    Args:
        criteria: Sourcing criteria dict
        conversation_id: Conversation ID to link candidates to
        max_results: Maximum candidates to return

    Returns:
        Dict with candidate_ids, total_found, and search metadata
    """
    try:
        # Import sourcing service
        from app.services.apify import search_linkedin_candidates

        # TODO: Also search GitHub and Indeed
        # from app.services.github import search_github_developers
        # from app.services.apollo import search_indeed_candidates

        # Build search query from criteria
        query_parts = []

        if criteria.get("role"):
            query_parts.append(criteria["role"])

        if criteria.get("required_skills"):
            query_parts.extend(criteria["required_skills"][:3])  # Top 3 skills

        search_query = " ".join(query_parts)

        # Search LinkedIn (primary source)
        linkedin_results = await search_linkedin_candidates(
            query=search_query,
            location=criteria.get("location"),
            experience_years=criteria.get("experience_years_min"),
            max_results=max_results,
        )

        # TODO: Search other platforms in parallel
        # github_results = await search_github_developers(...)
        # indeed_results = await search_indeed_candidates(...)

        all_candidates = linkedin_results  # + github_results + indeed_results

        # Save candidates to database
        candidate_ids = []

        for candidate in all_candidates[:max_results]:
            # Create sourced_candidate record (anonymized by default)
            candidate_data = {
                "name": candidate["name"],
                "email": candidate.get("email"),
                "phone": candidate.get("phone"),
                "linkedin_url": candidate.get("linkedin_url"),
                "role": candidate.get("role"),
                "company": candidate.get("company"),
                "location": candidate.get("location"),
                "experience_years": candidate.get("experience_years"),
                "skills": candidate.get("skills", []),
                "summary": candidate.get("summary"),
                "fit_score": candidate.get("fit_score", 0.0),
                "source": "linkedin",  # or github, indeed
                "is_anonymized": True,  # Default anonymized
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
            "platforms": ["linkedin"],  # TODO: Add more platforms
            "search_query": search_query,
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
    Tool(function_declarations=[
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
    ])
]


# =====================================================
# Main Agent Processing Function
# =====================================================


async def process_user_message(
    conversation_id: UUID, user_message: str, user_id: UUID
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process user message with sourcing assistant agent and stream response.

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

        # Initialize Gemini client
        client = Client()

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
            supabase.table("sourcing_conversations").update(
                {"stage": "requirements_gathering"}
            ).eq("id", str(conversation_id)).execute()

        # Stream response from agent
        response_text = ""
        search_triggered = False

        for chunk in client.models.generate_content_stream(
            model=AGENT_MODEL,
            contents=contents,
            config=GenerateContentConfig(
                system_instruction=AGENT_SYSTEM_INSTRUCTION,
                tools=tools,
                temperature=0.7,
            ),
        ):
            # Check for tool calls
            if hasattr(chunk, "function_call") and chunk.function_call:
                func_call = chunk.function_call
                func_name = func_call.name
                func_args = dict(func_call.args)

                # Execute tool function
                if func_name == "get_conversation_context":
                    result = await get_conversation_context(func_args["conversation_id"])

                elif func_name == "extract_criteria":
                    result = await extract_criteria(
                        func_args["message"],
                        func_args.get("current_criteria", {}),
                    )

                    # Update conversation criteria
                    supabase.table("sourcing_conversations").update(
                        {"sourcing_criteria": result}
                    ).eq("id", str(conversation_id)).execute()

                elif func_name == "search_candidates":
                    search_triggered = True

                    # Yield thinking indicator
                    yield {
                        "type": "thinking",
                        "data": {"message": "Searching for candidates..."},
                    }

                    result = await search_candidates(
                        func_args["criteria"],
                        func_args["conversation_id"],
                        func_args.get("max_results", 20),
                    )

                    if result.get("success"):
                        # Yield candidates event
                        yield {
                            "type": "candidates",
                            "data": {
                                "candidate_ids": result["candidate_ids"],
                                "total_found": result["total_found"],
                                "platforms": result.get("platforms", []),
                            },
                        }

                    else:
                        yield {
                            "type": "error",
                            "data": {
                                "error": "search_failed",
                                "message": result.get("error", "Failed to search candidates"),
                            },
                        }

            # Handle text response chunks
            if hasattr(chunk, "text") and chunk.text:
                response_text += chunk.text
                yield {"type": "message_chunk", "data": {"text": chunk.text}}

        # Save assistant response to database
        if response_text:
            supabase.table("sourcing_messages").insert({
                "conversation_id": str(conversation_id),
                "role": "assistant",
                "message_type": "text",
                "content": response_text,
            }).execute()

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
