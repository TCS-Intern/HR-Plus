"""Vapi AI service for phone screening."""

import hashlib
import hmac
from typing import Any

import httpx

from app.config import settings


class VapiService:
    """Service for Vapi AI phone screening operations."""

    BASE_URL = "https://api.vapi.ai"

    def __init__(self):
        self.api_key = settings.vapi_api_key
        self.assistant_id = settings.vapi_assistant_id
        self.webhook_secret = settings.vapi_webhook_secret
        self.phone_number = settings.vapi_phone_number

    def _headers(self) -> dict:
        """Get headers for Vapi API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def update_assistant(
        self,
        assistant_id: str,
        name: str = "Phone Screener",
        company_name: str = "Telentic",
        webhook_url: str | None = None,
    ) -> dict[str, Any]:
        """
        Update an existing Vapi assistant with proper phone screening config.

        Args:
            assistant_id: The Vapi assistant ID to update
            name: Assistant name
            company_name: Company name for branding
            webhook_url: Your API webhook URL (e.g., https://api.yoursite.com/api/v1/phone-screen/webhook)

        Returns:
            Updated assistant configuration
        """
        payload = {
            "name": name,
            "model": {
                "provider": "openai",
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": self._get_base_system_prompt(company_name),
                    }
                ],
            },
            "transcriber": {
                "provider": "deepgram",
                "model": "nova-2",
                "language": "en",
            },
            "voice": {
                "provider": "vapi",
                "voiceId": "Elliot",
            },
            "firstMessage": f"Hi! This is Alex, an AI recruiting assistant from {company_name}. I'm calling about a position you expressed interest in. Is now a good time for a quick chat?",
            "endCallMessage": "Thanks so much for your time today. Our team will review everything and get back to you within a few business days. Take care!",
            "voicemailMessage": "Hi, this is Alex from {company_name} calling about a job opportunity. Please call us back when you're available. Thank you!",
            "analysisPlan": {
                "summaryPlan": {
                    "enabled": True,
                },
                "successEvaluationPlan": {
                    "enabled": True,
                },
            },
        }

        # Add webhook URL if provided
        if webhook_url:
            payload["serverUrl"] = webhook_url

        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.BASE_URL}/assistant/{assistant_id}",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    def _get_base_system_prompt(self, company_name: str) -> str:
        """Get base system prompt for phone screening."""
        return f"""You are Alex, a friendly and professional AI phone screener for {company_name}.

## Your Personality
- Warm, conversational, but professional
- A good listener who asks follow-up questions
- Respectful of the candidate's time
- Never robotic or overly formal

## Guidelines
- Keep responses under 35 words
- Ask ONE question at a time
- Listen actively - acknowledge what they say before moving on
- If they give vague answers, ask for specifics
- Be honest if you don't know something

## Call Structure
1. Confirm you're speaking with the right person
2. Ask about their current role
3. Discuss relevant experience
4. Understand their interest and timeline
5. Answer their questions
6. Thank them and explain next steps

Remember: Your goal is a natural conversation that assesses fit while giving a positive experience."""

    async def create_assistant(
        self,
        name: str,
        job_title: str,
        company_name: str,
        skills_to_probe: list[str],
        custom_instructions: str = "",
    ) -> dict[str, Any]:
        """
        Create a Vapi assistant for phone screening a specific role.

        Returns:
            {id, name, ...}
        """
        system_prompt = self._generate_system_prompt(
            job_title=job_title,
            company_name=company_name,
            skills_to_probe=skills_to_probe,
            custom_instructions=custom_instructions,
        )

        payload = {
            "name": name,
            "model": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.7,
                "maxTokens": 250,
                "messages": [{"role": "system", "content": system_prompt}],
            },
            "transcriber": {
                "provider": "deepgram",
                "model": "nova-2-conversationalai",
                "language": "en",
                "smartEndpointing": True,
                "endpointing": 300,
                "keywords": [skill + ":2" for skill in skills_to_probe[:10]],
            },
            "voice": {
                "provider": "deepgram",
                "voiceId": "aura-asteria-en",
                "speed": 1.1,
            },
            "firstMessage": f"Hi! This is Alex, an AI recruiting assistant from {company_name}. I'm calling about the {job_title} position you expressed interest in. Is now a good time to chat for about 10 to 15 minutes?",
            "firstMessageMode": "assistant-speaks-first",
            "silenceTimeoutSeconds": 30,
            "maxDurationSeconds": 900,  # 15 minutes max
            "backgroundSound": "off",
            "backchannelingEnabled": True,
            "backgroundDenoisingEnabled": True,
            "endCallMessage": "Thanks so much for your time today. Our team will review everything and get back to you within a few business days. Take care!",
            "endCallPhrases": [
                "goodbye",
                "bye",
                "have a great day",
                "take care",
                "thanks that's all",
            ],
            "serverMessages": ["end-of-call-report", "transcript", "status-update"],
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/assistant",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def initiate_call(
        self,
        phone_number: str,
        candidate_name: str,
        job_title: str,
        company_name: str,
        skills_to_probe: list[str],
        assistant_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict[str, Any]:
        """
        Initiate an outbound phone screen call to a candidate.

        Args:
            phone_number: Candidate's phone number (E.164 format)
            candidate_name: Candidate's name for personalization
            job_title: Job title being screened for
            company_name: Company name
            skills_to_probe: List of skills to ask about
            assistant_id: Optional specific assistant ID (uses default if not provided)
            metadata: Optional metadata to attach to the call

        Returns:
            {id, status, ...}
        """
        # Use provided assistant or default
        use_assistant_id = assistant_id or self.assistant_id

        # Generate dynamic prompt based on context
        system_prompt = self._generate_system_prompt(
            job_title=job_title,
            company_name=company_name,
            skills_to_probe=skills_to_probe,
            candidate_name=candidate_name,
        )

        payload = {
            "phoneNumberId": self.phone_number,  # Your Vapi phone number ID
            "customer": {"number": phone_number, "name": candidate_name},
            "assistantId": use_assistant_id,
            "assistantOverrides": {
                "model": {"messages": [{"role": "system", "content": system_prompt}]},
                "firstMessage": f"Hi! This is Alex, an AI recruiting assistant from {company_name}. I'm calling for {candidate_name} about the {job_title} position. Is now a good time for a quick 10 to 15 minute chat?",
            },
            "metadata": {
                "candidate_name": candidate_name,
                "job_title": job_title,
                "company_name": company_name,
                "skills_to_probe": skills_to_probe,
                **(metadata or {}),
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/call/phone",
                headers=self._headers(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_call(self, call_id: str) -> dict[str, Any]:
        """Get call details from Vapi."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/call/{call_id}",
                headers=self._headers(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def get_call_transcript(self, call_id: str) -> list[dict]:
        """
        Get transcript for a completed call.

        Returns:
            List of transcript messages [{role, content, timestamp}, ...]
        """
        call_data = await self.get_call(call_id)
        return call_data.get("messages", [])

    async def get_call_recording_url(self, call_id: str) -> str | None:
        """Get recording URL for a completed call."""
        call_data = await self.get_call(call_id)
        return call_data.get("recordingUrl")

    async def end_call(self, call_id: str) -> dict[str, Any]:
        """End an in-progress call."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/call/{call_id}/stop",
                headers=self._headers(),
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    async def list_calls(
        self,
        limit: int = 50,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        """List recent calls."""
        params = {"limit": limit}
        if status:
            params["status"] = status

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/call",
                headers=self._headers(),
                params=params,
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify Vapi webhook signature for security.

        Args:
            payload: Raw request body bytes
            signature: X-Vapi-Signature header value

        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            # Skip verification if no secret configured (dev mode only!)
            return True

        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, signature)

    def _generate_system_prompt(
        self,
        job_title: str,
        company_name: str,
        skills_to_probe: list[str],
        candidate_name: str = "",
        custom_instructions: str = "",
    ) -> str:
        """Generate the system prompt for the phone screen assistant."""
        skills_list = "\n".join([f"- {skill}" for skill in skills_to_probe[:8]])

        return f"""You are Alex, a friendly and professional AI phone screener conducting a 10-15 minute qualification call for the {job_title} position at {company_name}.

## Your Personality
- Warm, conversational, but professional
- A good listener who asks follow-up questions
- Respectful of the candidate's time
- Never robotic or overly formal

## Call Structure (10-15 minutes total)

### 1. Opening (1 min)
- Confirm you're speaking with the right person
- Briefly explain the purpose: a quick chat to learn about their background
- Ask if now is a good time

### 2. Background Overview (3-4 min)
- "Tell me about your current role and what you work on day-to-day?"
- Follow up on interesting points they mention

### 3. Technical/Skill Questions (4-5 min)
Probe their experience with these key skills:
{skills_list}

For each relevant skill, ask for specific examples:
- "Can you tell me about a project where you used [skill]?"
- "What was your specific contribution?"

### 4. Motivation & Logistics (2-3 min)
- "What interests you about this {job_title} role specifically?"
- "What's your timeline for making a move?"
- "What are your compensation expectations?" (if they're comfortable sharing)

### 5. Candidate Questions (2 min)
- "What questions do you have about the role or {company_name}?"
- Answer briefly based on what you know

### 6. Closing (30 sec)
- Thank them for their time
- Explain next steps: "Our team will review and follow up within a few business days"

## Important Guidelines
- Keep your responses under 35 words
- Ask ONE question at a time
- Listen actively - acknowledge what they say before moving on
- If they give vague answers, ask for specifics: "Can you give me an example?"
- If they seem uncomfortable with a question, gracefully move on
- Be honest if you don't know something: "I don't have that detail, but the team can follow up"

## Red Flags to Note (internally)
- Very short tenure at multiple jobs
- Can't give specific examples of their work
- Compensation expectations far outside range
- Negative comments about past employers
- Unprofessional communication

## What NOT to Do
- Don't give advice or feedback on their answers
- Don't make promises about the process
- Don't discuss other candidates
- Don't be pushy if they seem hesitant

{custom_instructions}

Remember: Your goal is to have a natural conversation that helps assess fit while giving the candidate a positive experience with {company_name}."""


# Singleton instance
vapi_service = VapiService()
