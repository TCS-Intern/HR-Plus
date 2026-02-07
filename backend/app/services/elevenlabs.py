"""ElevenLabs Conversational AI service for browser-based voice interviews."""

from typing import Any

import httpx

from app.config import settings


class ElevenLabsService:
    """Service for ElevenLabs Conversational AI voice interview operations."""

    BASE_URL = "https://api.elevenlabs.io"

    def __init__(self):
        self.api_key = settings.elevenlabs_api_key
        self.agent_id = settings.elevenlabs_agent_id

    def _headers(self) -> dict:
        """Get headers for ElevenLabs API requests."""
        return {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def get_signed_url(self, agent_id: str) -> str:
        """
        Get a time-limited signed WebSocket URL for a conversation session.

        Args:
            agent_id: The ElevenLabs agent ID to connect to.

        Returns:
            Signed WebSocket URL string.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/v1/convai/conversation/get-signed-url",
                headers=self._headers(),
                params={"agent_id": agent_id},
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["signed_url"]

    async def create_agent(
        self,
        name: str,
        system_prompt: str,
        first_message: str,
        max_duration: int = 900,
    ) -> dict[str, Any]:
        """
        Create a per-session ElevenLabs conversational agent.

        Args:
            name: Agent name for identification.
            system_prompt: The system prompt with interview instructions.
            first_message: Opening greeting message.
            max_duration: Max conversation duration in seconds (default 15 min).

        Returns:
            Agent data including agent_id.
        """
        payload = {
            "conversation_config": {
                "agent": {
                    "prompt": {
                        "prompt": system_prompt,
                    },
                    "first_message": first_message,
                    "language": "en",
                },
                "conversation": {
                    "max_duration_seconds": max_duration,
                },
                "tts": {
                    "voice_id": "21m00Tcm4TlvDq8ikWAM",  # Rachel - natural conversational voice
                },
            },
            "name": name,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/v1/convai/agents/create",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_conversation(self, conversation_id: str) -> dict[str, Any]:
        """
        Fetch conversation details including authoritative transcript.

        Args:
            conversation_id: The ElevenLabs conversation ID.

        Returns:
            Conversation data with transcript.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/v1/convai/conversations/{conversation_id}",
                headers=self._headers(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def delete_agent(self, agent_id: str) -> None:
        """
        Delete a per-session agent after interview completion.

        Args:
            agent_id: The agent ID to delete.
        """
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.BASE_URL}/v1/convai/agents/{agent_id}",
                headers=self._headers(),
                timeout=30.0,
            )
            # 404 is fine - agent may already be deleted
            if response.status_code != 404:
                response.raise_for_status()

    def build_voice_interview_prompt(
        self,
        candidate_name: str,
        job_title: str,
        skills_to_probe: list[str],
    ) -> str:
        """
        Generate system prompt for voice interview agent.

        Adapted from PhoneInterviewAgent prompt, tuned for voice:
        shorter responses (<35 words), one question at a time.
        """
        skills_list = "\n".join([f"- {skill}" for skill in skills_to_probe[:8]])

        return f"""You are Alex, a friendly and professional AI phone screener conducting a 10-15 minute qualification call for the {job_title} position.
You are interviewing {candidate_name}.

## Your Personality
- Warm, conversational, but professional
- A good listener who asks thoughtful follow-up questions
- Respectful of the candidate's time
- Never robotic or overly formal

## Call Structure (10-15 minutes total)

### 1. Opening (1 min)
- Confirm you're speaking with {candidate_name}
- Briefly explain: "I'll ask about your background, dig into some technical areas, then you can ask me anything."
- Ask if now is a good time

### 2. Background Overview (3-4 min)
- "Tell me about your current role and what you work on day-to-day?"
- Follow up on interesting points they mention
- Ask about team size, their specific responsibilities, and scope of impact
- "What's been the most challenging project you've worked on recently?"

### 3. Technical/Skill Deep-Dives (4-5 min)
Probe their experience with these key skills for the {job_title} role:
{skills_list}

For EACH relevant skill, dig deeper — don't accept surface-level answers:
- "Can you walk me through a specific project where you used [skill]?"
- "What was your specific contribution vs the team's?"
- "What technical decisions did you make and why?"
- "What would you do differently if you did it again?"
- If they claim expertise, ask about edge cases, trade-offs, or debugging scenarios
- If they mention a technology, ask about version, scale, or production usage

### 4. Motivation & Logistics (2-3 min)
- "What interests you about this {job_title} role specifically?"
- "What's your timeline for making a move?"
- "Do you have a sense of your compensation expectations?" (if comfortable)
- "Are you interviewing elsewhere right now?"

### 5. Candidate Questions (2 min)
- "What questions do you have about the role or the company?"
- Answer briefly based on what you know — be honest if you don't have details

### 6. Closing (30 sec)
- Thank them for their time
- "Our team will review everything and follow up within a few business days."

## Critical Voice Guidelines
- Keep EVERY response under 35 words
- Ask ONE question at a time — never stack questions
- Acknowledge their answer before asking the next question ("That's interesting.", "Got it.", "Makes sense.")
- Use natural speech (contractions, brief affirmations)
- Push back gently on vague answers: "Can you give me a concrete example?" or "What specifically did you build?"
- Adapt your questions to what they've told you — don't follow a rigid script

## Red Flags to Note Internally
- Can't give specific examples of their work
- Claims expertise but can't discuss trade-offs or debugging
- Very short tenure at multiple jobs without explanation
- Compensation expectations far outside typical range
- Evasive or defensive when asked for details

## What NOT to Do
- Don't accept "I'm pretty good at X" without probing — always ask for specifics
- Don't give advice or feedback on their answers
- Don't make promises about hiring decisions
- Don't discuss other candidates
- Don't skip the technical deep-dive — it's the most important part
- Don't let the candidate control the conversation flow entirely"""

    def build_first_message(self, candidate_name: str, job_title: str) -> str:
        """Generate the opening greeting for the voice interview."""
        return (
            f"Hi {candidate_name}! I'm Alex, an AI recruiting assistant. "
            f"Thanks for joining this voice interview for the {job_title} position. "
            f"Is now a good time for a quick 10 to 15 minute chat?"
        )


# Singleton instance
elevenlabs_service = ElevenLabsService()
