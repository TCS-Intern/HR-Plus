"""Phone Interview Agent - Conducts conversational web-based interviews."""

from collections.abc import AsyncGenerator
from typing import Any

from google import genai
from google.genai import types

from app.config import settings

PHONE_INTERVIEW_SYSTEM_PROMPT = """You are an AI interviewer conducting a phone screen for {company_name}.
You are interviewing {candidate_name} for the {job_title} position.

YOUR PERSONALITY:
- Professional but warm and conversational
- Encouraging and supportive
- Clear and concise in your questions
- Active listener who acknowledges candidate responses

INTERVIEW STRUCTURE:
1. INTRODUCTION (1 message): Welcome the candidate, introduce yourself, confirm they're ready
2. QUESTIONS (5-7 questions): Ask about experience, skills, and fit
3. WRAP-UP (1-2 messages): Ask if they have questions, thank them, explain next steps

SKILLS TO PROBE:
{skills_to_probe}

QUESTION GUIDELINES:
- Start with an easy warm-up question about their background
- Ask about specific skills relevant to the job
- Include behavioral questions (STAR format encouraged)
- Ask about compensation expectations and availability
- Keep questions conversational, not interrogation-style

RESPONSE FORMAT:
- Keep responses concise (2-4 sentences typically)
- One question at a time
- Acknowledge their answers before asking follow-ups
- Use their name occasionally to stay personal

ENDING THE INTERVIEW:
When you've covered the key topics (typically after 5-7 substantive exchanges), transition to wrap-up:
1. Ask if they have any questions about the role or company
2. Thank them for their time
3. Explain that the team will follow up soon
4. End with a friendly goodbye

IMPORTANT:
- Never make hiring decisions or promises
- If they ask about salary ranges, say the recruiting team will discuss specifics
- Stay focused on learning about the candidate
- If they go off-topic, gently guide back
"""


class PhoneInterviewAgent:
    """Manages conversational phone interview sessions."""

    def __init__(self):
        self.client = genai.Client(api_key=settings.google_api_key)
        self.model = settings.gemini_model

    def _build_system_prompt(
        self,
        candidate_name: str,
        job_title: str,
        skills_to_probe: list[str],
        company_name: str = "TalentAI",
    ) -> str:
        """Build the system prompt with context."""
        skills_str = "\n".join(f"- {skill}" for skill in skills_to_probe) if skills_to_probe else "- General professional skills"

        return PHONE_INTERVIEW_SYSTEM_PROMPT.format(
            company_name=company_name,
            candidate_name=candidate_name,
            job_title=job_title,
            skills_to_probe=skills_str,
        )

    def _build_conversation_history(
        self,
        transcript: list[dict[str, Any]],
    ) -> list[types.Content]:
        """Convert transcript to Gemini conversation format."""
        history = []
        for msg in transcript:
            role = "model" if msg.get("role") == "assistant" else "user"
            history.append(
                types.Content(
                    role=role,
                    parts=[types.Part(text=msg.get("content", ""))]
                )
            )
        return history

    async def generate_response(
        self,
        candidate_name: str,
        job_title: str,
        skills_to_probe: list[str],
        transcript: list[dict[str, Any]],
        user_message: str,
        company_name: str = "TalentAI",
    ) -> AsyncGenerator[str, None]:
        """
        Generate a streaming response from the interview agent.

        Args:
            candidate_name: Name of the candidate being interviewed
            job_title: Title of the job
            skills_to_probe: List of skills to ask about
            transcript: Previous conversation messages
            user_message: The candidate's current message
            company_name: Name of the hiring company

        Yields:
            Text chunks as they're generated
        """
        system_prompt = self._build_system_prompt(
            candidate_name=candidate_name,
            job_title=job_title,
            skills_to_probe=skills_to_probe,
            company_name=company_name,
        )

        # Build conversation history
        history = self._build_conversation_history(transcript)

        # Add the current user message
        history.append(
            types.Content(
                role="user",
                parts=[types.Part(text=user_message)]
            )
        )

        # Generate streaming response
        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=500,
            ),
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    async def generate_opening_message(
        self,
        candidate_name: str,
        job_title: str,
        company_name: str = "TalentAI",
    ) -> str:
        """Generate the opening message for the interview."""
        prompt = f"""Generate a brief, warm opening message for a phone screen interview.

Candidate: {candidate_name}
Position: {job_title}
Company: {company_name}

The message should:
1. Greet the candidate by name
2. Introduce yourself as an AI interviewer
3. Briefly mention the position
4. Ask if they're ready to begin

Keep it to 2-3 sentences, conversational and friendly."""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=200,
            ),
        )

        return response.text if response.text else f"Hi {candidate_name}! I'm an AI interviewer from {company_name}. Thanks for joining me today to discuss the {job_title} position. Are you ready to get started?"

    def should_end_interview(
        self,
        transcript: list[dict[str, Any]],
        conversation_state: dict[str, Any],
    ) -> bool:
        """
        Determine if the interview should be concluded.

        The interview typically ends after:
        - 5-7 substantive Q&A exchanges
        - The candidate has asked their questions
        - Wrap-up messages have been sent
        """
        # Count substantive exchanges (user messages after intro)
        user_messages = [m for m in transcript if m.get("role") == "user"]

        # If we've had enough exchanges
        if len(user_messages) >= 8:
            return True

        # Check if we're in wrap-up state
        if conversation_state.get("in_wrap_up"):
            wrap_up_count = conversation_state.get("wrap_up_messages", 0)
            if wrap_up_count >= 2:
                return True

        return False

    def detect_wrap_up_trigger(self, assistant_message: str) -> bool:
        """Check if the assistant message indicates wrap-up phase."""
        wrap_up_indicators = [
            "any questions",
            "questions for me",
            "anything you'd like to ask",
            "thank you for your time",
            "thanks for taking the time",
            "we'll be in touch",
            "team will follow up",
        ]
        message_lower = assistant_message.lower()
        return any(indicator in message_lower for indicator in wrap_up_indicators)


# Singleton instance
phone_interview_agent = PhoneInterviewAgent()
