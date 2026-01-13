"""Agent Coordinator - Orchestrates multi-agent workflows."""

import os
import uuid
from typing import Any

from google.adk.agents import SequentialAgent
from google.adk.runners import InMemoryRunner
from google.genai import types
from google import genai

from app.config import settings

# Configure the genai client globally with API key
os.environ["GOOGLE_API_KEY"] = settings.google_api_key

from app.agents.jd_assist import jd_assist_agent
from app.agents.talent_screener import talent_screener_agent
from app.agents.talent_assessor import talent_assessor_agent, talent_assessor_questions_agent
from app.agents.offer_generator import offer_generator_agent


class AgentCoordinator:
    """Orchestrates the talent acquisition agent pipeline."""

    def __init__(self) -> None:
        """Initialize the coordinator."""
        # Full hiring pipeline (sequential)
        self.hiring_pipeline = SequentialAgent(
            name="hiring_pipeline",
            sub_agents=[
                jd_assist_agent,
                talent_screener_agent,
                talent_assessor_agent,
                offer_generator_agent,
            ],
        )

    async def _run_agent(self, agent: Any, user_input: str, user_id: str = "system") -> dict:
        """Execute a single agent and return the result."""
        import json
        import logging

        logger = logging.getLogger(__name__)
        runner = InMemoryRunner(agent=agent, app_name=agent.name)

        # Create a session using the runner's session service
        session = await runner.session_service.create_session(
            app_name=agent.name,
            user_id=user_id,
        )

        # Create proper Content object for user message
        user_message = types.Content(
            role="user",
            parts=[types.Part(text=user_input)]
        )

        text_response = ""
        async for event in runner.run_async(
            session_id=session.id,
            user_id=user_id,
            new_message=user_message,
        ):
            # Extract text from content if available
            if event.content:
                content = event.content
                if hasattr(content, 'parts'):
                    for part in content.parts:
                        if hasattr(part, 'text') and part.text:
                            text_response += part.text
                elif isinstance(content, str):
                    text_response += content

        await runner.close()

        # Try to parse as JSON
        if text_response:
            # Remove markdown code blocks if present
            cleaned = text_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON response: {text_response[:500]}")
                return {"response": text_response}

        return {"response": text_response}

    async def run_jd_assist(self, input_data: dict[str, Any]) -> dict:
        """Run the JD Assist agent to create a job description."""
        # Get content from various possible fields
        content = (
            input_data.get('input_text') or
            input_data.get('voice_transcript') or
            input_data.get('content') or
            ''
        )

        prompt = f"""Create a job description based on the following input:

Input Type: {input_data.get('input_type', 'text')}
Content: {content}
Department: {input_data.get('department', 'Not specified')}
Hiring Manager: {input_data.get('hiring_manager', 'Not specified')}
Urgency: {input_data.get('urgency', 'normal')}

Generate a complete, structured job description with skills matrix and evaluation criteria.
Output ONLY valid JSON matching this schema (no markdown, no explanation):
{{
    "title": "string",
    "department": "string",
    "location": "string",
    "job_type": "full-time|part-time|contract|internship",
    "remote_policy": "remote|hybrid|onsite",
    "summary": "2-3 sentence summary",
    "description": "full description",
    "responsibilities": ["list of responsibilities"],
    "qualifications": {{"required": ["list"], "preferred": ["list"]}},
    "skills_matrix": {{
        "required": [{{"skill": "name", "proficiency": "level", "weight": 0.0-1.0}}],
        "nice_to_have": [{{"skill": "name", "proficiency": "level", "weight": 0.0-1.0}}]
    }},
    "evaluation_criteria": [{{"criterion": "name", "weight": 0-100, "description": "text", "assessment_method": "interview|technical|behavioral|portfolio"}}],
    "suggested_questions": {{"technical": ["questions"], "behavioral": ["questions"], "situational": ["questions"]}},
    "salary_range": {{"min": number, "max": number, "currency": "USD"}}
}}"""

        return await self._run_agent(jd_assist_agent, prompt)

    async def run_talent_screener(
        self,
        job_data: dict[str, Any],
        candidates: list[dict[str, Any]],
    ) -> dict:
        """Run the Talent Screener agent to score candidates."""
        prompt = f"""Screen the following candidates against the job requirements:

Job Data:
{job_data}

Candidates to Screen:
{candidates}

Analyze each candidate's qualifications, score them against requirements, and provide recommendations."""

        return await self._run_agent(talent_screener_agent, prompt)

    async def run_assessor_questions(
        self,
        job_id: str,
        candidate_id: str,
    ) -> dict:
        """Generate assessment questions for a candidate."""
        prompt = f"""Generate assessment questions for:

Job ID: {job_id}
Candidate ID: {candidate_id}

Create a mix of technical, behavioral, and situational questions tailored to the role and candidate background."""

        return await self._run_agent(talent_assessor_questions_agent, prompt)

    async def run_video_analysis(
        self,
        video_url: str,
        questions: list[dict[str, Any]],
        job_requirements: dict[str, Any],
    ) -> dict:
        """Analyze a candidate's video assessment."""
        prompt = f"""Analyze the candidate's video assessment:

Video URL: {video_url}
Questions Asked: {questions}
Job Requirements: {job_requirements}

Evaluate response quality, communication skills, and provide a hiring recommendation."""

        return await self._run_agent(talent_assessor_agent, prompt)

    async def run_offer_generator(self, offer_input: dict[str, Any]) -> dict:
        """Generate an offer package for a candidate."""
        prompt = f"""Generate an offer package based on:

Application ID: {offer_input.get('application_id')}
Candidate Name: {offer_input.get('candidate_name')}
Candidate Email: {offer_input.get('candidate_email')}
Job Title: {offer_input.get('job_title')}
Department: {offer_input.get('department')}
Salary Range: ${offer_input.get('salary_range_min', 0):,.0f} - ${offer_input.get('salary_range_max', 0):,.0f}
Experience Years: {offer_input.get('experience_years', 0)}
Assessment Score: {offer_input.get('assessment_score', 0)}

Create a competitive offer with compensation details, benefits, and a professional offer letter."""

        return await self._run_agent(offer_generator_agent, prompt)

    async def run_full_pipeline(self, initial_input: str) -> dict:
        """Run the complete hiring pipeline from JD creation to offer."""
        return await self._run_agent(self.hiring_pipeline, initial_input)


# Global coordinator instance
agent_coordinator = AgentCoordinator()
