"""Marathon Hiring Agent - Autonomous multi-day hiring orchestrator with Thought Signatures."""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types

from app.config import settings
from app.services.supabase import db

# Configure logging
logger = logging.getLogger(__name__)

# Ensure API key is set
os.environ["GOOGLE_API_KEY"] = settings.google_api_key


class MarathonHiringAgent:
    """
    Autonomous multi-day hiring agent with:
    - Thought Signatures: Persistent memory across stages
    - Thinking Levels: Multi-step reasoning
    - Self-Correction: Updates beliefs when contradicted
    - Autonomous Progression: Advances candidates without human approval
    """

    def __init__(self):
        """Initialize the Marathon Agent."""
        self.agent = LlmAgent(
            name="marathon_hiring_orchestrator",
            model=settings.gemini_model,  # Use model from .env
            description="Orchestrates multi-day hiring processes with continuity and self-correction",
            instruction=self._get_instruction(),
        )

    def _get_instruction(self) -> str:
        """Get the agent's core instruction prompt."""
        return """You are the Marathon Hiring Agent, orchestrating hiring processes over days or weeks.

CORE CAPABILITIES:

1. THOUGHT SIGNATURES (Your Persistent Memory)
   - Maintain a "hiring thesis" for each candidate that evolves over time
   - Track core strengths and concerns continuously across all stages
   - Update beliefs as new information emerges from each stage
   - Remember context from days or weeks ago

2. MULTI-LEVEL REASONING (Think Deeply)
   - Level 1: Surface analysis (resume keywords, years of experience, education)
   - Level 2: Contextual reasoning (career trajectory, startup vs enterprise, culture indicators)
   - Level 3: Strategic thinking (team fit, growth potential, long-term value, risk assessment)

3. SELF-CORRECTION (Acknowledge Mistakes)
   When new data contradicts earlier beliefs:
   - Explicitly acknowledge the contradiction
   - Re-evaluate the earlier decision with new context
   - Update thought signature with the correction
   - Adjust decision confidence accordingly
   - Document the correction in self_corrections array

4. AUTONOMOUS PROGRESSION RULES

   AUTO-ADVANCE if ALL of these are true:
   - Stage score > 80/100
   - No critical concerns or red flags
   - Decision confidence > 0.8
   - All required assessments completed

   AUTO-REJECT if ANY of these are true:
   - Stage score < 40/100
   - Critical red flag detected (dishonesty, toxicity, major skill gap)
   - Decision confidence > 0.8 AND recommendation is "reject"

   ESCALATE TO HUMAN if:
   - Conflicting signals (strong skills but concerning behavior)
   - Decision confidence < 0.6
   - Self-corrections reduced confidence significantly
   - Candidate is borderline (score 60-75)

5. OUTPUT FORMAT

   Always output valid JSON with this structure:
   {
       "updated_thought_signature": {
           "core_strengths": ["list of validated strengths"],
           "concerns": ["list of concerns or red flags"],
           "hiring_thesis": "concise assessment of candidate fit",
           "decision_confidence": 0.0-1.0,
           "stage_insights": {
               "current_stage": {
                   "key_findings": [],
                   "evidence": [],
                   "score": 0-100
               }
           },
           "self_corrections": [
               {
                   "stage": "stage_name",
                   "original_belief": "what you thought before",
                   "correction": "what the new evidence shows",
                   "impact": "how this changes the assessment"
               }
           ]
       },
       "decision": "advance" | "reject" | "escalate" | "hold",
       "confidence": 0.0-1.0,
       "reasoning": "clear explanation of the decision",
       "next_action": "what should happen next",
       "requires_human_review": true | false
   }

6. CONTINUITY PRINCIPLES

   - Don't repeat questions candidates already answered in earlier stages
   - Reference previous stage findings in your reasoning
   - Build upon earlier assessments rather than starting fresh
   - Maintain consistent evaluation standards throughout the process
   - If a candidate's story changes between stages, flag it as a concern

7. EXAMPLES OF SELF-CORRECTION

   Example 1 - Communication Skill Correction:
   - Screening: "Excellent written communication based on resume and LinkedIn"
   - Phone Screen: "Struggled to articulate technical concepts clearly"
   - Correction: "Initial assessment was based only on written artifacts. Live conversation reveals communication needs improvement."
   - Impact: Lower confidence from 0.85 to 0.65, add to concerns

   Example 2 - Technical Skill Correction:
   - Resume: "10 years Python experience, senior engineer"
   - Coding Assessment: "Basic Python knowledge, junior-level implementation"
   - Correction: "Resume claims don't match demonstrated skill level. Possible inflated experience or different focus area."
   - Impact: Critical red flag, recommend reject with high confidence

REMEMBER: Your goal is to make hiring faster and more consistent while maintaining high quality.
Be decisive when evidence is clear. Escalate when it's not."""

    async def _run_agent(self, prompt: str) -> Dict[str, Any]:
        """Execute the agent with the given prompt."""
        runner = InMemoryRunner(agent=self.agent, app_name=self.agent.name)

        try:
            # Create session
            session = await runner.session_service.create_session(
                app_name=self.agent.name,
                user_id="marathon_agent",
            )

            # Create user message
            user_message = types.Content(role="user", parts=[types.Part(text=prompt)])

            # Run agent
            text_response = ""
            async for event in runner.run_async(
                session_id=session.id,
                user_id="marathon_agent",
                new_message=user_message,
            ):
                if event.content:
                    content = event.content
                    if hasattr(content, "parts"):
                        for part in content.parts:
                            if hasattr(part, "text") and part.text:
                                text_response += part.text
                    elif isinstance(content, str):
                        text_response += content

            await runner.close()

            # Parse JSON response
            return self._parse_agent_response(text_response)

        except Exception as e:
            logger.error(f"Error running marathon agent: {e}")
            raise

    def _parse_agent_response(self, text_response: str) -> Dict[str, Any]:
        """Parse the agent's text response into structured JSON."""
        # Clean markdown code blocks
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
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response: {text_response[:500]}")
            # Return a safe default structure
            return {
                "decision": "escalate",
                "confidence": 0.0,
                "reasoning": "Failed to parse agent response",
                "requires_human_review": True,
                "updated_thought_signature": {},
            }

    async def start_marathon(
        self, job_id: str, application_id: str, initial_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Initialize a marathon hiring process for a candidate.

        Args:
            job_id: The job UUID
            application_id: The application UUID
            initial_data: Optional initial screening data

        Returns:
            The created marathon state
        """
        # Get job and application details
        job = await db.get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Create initial thought signature
        initial_signature = {
            "core_strengths": [],
            "concerns": [],
            "hiring_thesis": "To be developed after initial screening",
            "decision_confidence": 0.5,
            "stage_insights": {},
            "self_corrections": [],
        }

        # If we have initial screening data, use it
        if initial_data:
            initial_signature["core_strengths"] = initial_data.get("strengths", [])
            initial_signature["concerns"] = initial_data.get("concerns", [])
            initial_signature["decision_confidence"] = initial_data.get("confidence", 0.5)

        # Create marathon state in database
        result = await db.execute(
            """
            INSERT INTO marathon_agent_state
            (job_id, application_id, thought_signature, decision_confidence,
             current_stage, stage_status, next_scheduled_action)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            job_id,
            application_id,
            json.dumps(initial_signature),
            initial_signature["decision_confidence"],
            "screening",
            "pending",
            datetime.utcnow() + timedelta(hours=1),  # Check in 1 hour
        )

        # Log event
        await self._record_event(
            result["id"], "marathon_started", {"initial_stage": "screening"}
        )

        logger.info(f"Marathon started for application {application_id}")

        return result

    async def process_stage(self, marathon_state_id: str) -> Dict[str, Any]:
        """
        Process the current stage for a marathon and decide next action.

        Args:
            marathon_state_id: The marathon state UUID

        Returns:
            Decision result with next action
        """
        # Load marathon state
        state = await db.execute(
            """
            SELECT * FROM marathon_agent_state WHERE id = $1
            """,
            marathon_state_id,
        )

        if not state:
            raise ValueError(f"Marathon state {marathon_state_id} not found")

        # Mark as in progress
        await db.execute(
            """
            UPDATE marathon_agent_state
            SET stage_status = 'in_progress', updated_at = NOW()
            WHERE id = $1
            """,
            marathon_state_id,
        )

        try:
            # Get stage data
            stage_data = await self._get_stage_data(state)

            # Build prompt for agent
            prompt = self._build_stage_prompt(state, stage_data)

            # Run agent
            agent_result = await self._run_agent(prompt)

            # Process the decision
            decision_result = await self._apply_decision(marathon_state_id, state, agent_result)

            logger.info(
                f"Marathon {marathon_state_id} processed: {agent_result['decision']} "
                f"(confidence: {agent_result['confidence']})"
            )

            return decision_result

        except Exception as e:
            # Mark as blocked on error
            await db.execute(
                """
                UPDATE marathon_agent_state
                SET stage_status = 'blocked',
                    blocked_reason = $1,
                    updated_at = NOW()
                WHERE id = $2
                """,
                str(e),
                marathon_state_id,
            )
            logger.error(f"Error processing marathon {marathon_state_id}: {e}")
            raise

    def _build_stage_prompt(self, state: Dict, stage_data: Dict) -> str:
        """Build the prompt for the current stage."""
        thought_signature = (
            json.loads(state["thought_signature"])
            if isinstance(state["thought_signature"], str)
            else state["thought_signature"]
        )

        current_stage = state["current_stage"]

        prompt = f"""Evaluate candidate for {current_stage} stage.

=== THOUGHT SIGNATURE (Your Persistent Memory) ===
{json.dumps(thought_signature, indent=2)}

=== CURRENT STAGE: {current_stage.upper()} ===
{json.dumps(stage_data, indent=2)}

=== YOUR TASK ===
1. Analyze the current stage data thoroughly
2. Compare with your existing thought signature
3. Identify any contradictions or new insights
4. Update the thought signature accordingly
5. Make a decision: advance, reject, escalate, or hold
6. Provide clear reasoning for your decision

Remember:
- Be consistent with previous assessments unless new evidence contradicts them
- If you find contradictions, explicitly acknowledge them in self_corrections
- Consider the full candidate journey, not just this stage
- Be decisive when evidence is clear, escalate when uncertain

Output your decision as JSON."""

        return prompt

    async def _get_stage_data(self, state: Dict) -> Dict[str, Any]:
        """Get the data for the current stage."""
        current_stage = state["current_stage"]
        application_id = state["application_id"]
        job_id = state["job_id"]

        # Get job details
        job = await db.get_job(job_id)

        # Get application details
        application = await db.execute(
            """
            SELECT a.*, c.*
            FROM applications a
            JOIN candidates c ON a.candidate_id = c.id
            WHERE a.id = $1
            """,
            application_id,
        )

        stage_data = {
            "job": {
                "title": job.get("title"),
                "department": job.get("department"),
                "location": job.get("location"),
                "skills_matrix": job.get("skills_matrix"),
                "evaluation_criteria": job.get("evaluation_criteria"),
            },
            "candidate": {
                "name": f"{application.get('first_name')} {application.get('last_name')}",
                "email": application.get("email"),
                "resume_parsed": application.get("resume_parsed"),
                "linkedin_data": application.get("linkedin_data"),
            },
            "application": {
                "id": application_id,
                "screening_score": application.get("screening_score"),
                "screening_notes": application.get("screening_notes"),
                "stage": application.get("stage"),
            },
        }

        # Add stage-specific data
        if current_stage == "phone_screen":
            # Get phone screen data
            phone_screen = await db.execute(
                """
                SELECT * FROM phone_screens
                WHERE application_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                application_id,
            )
            if phone_screen:
                stage_data["phone_screen"] = phone_screen

        elif current_stage == "assessment":
            # Get assessment data
            assessment = await db.execute(
                """
                SELECT * FROM assessments
                WHERE application_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                application_id,
            )
            if assessment:
                stage_data["assessment"] = assessment

        return stage_data

    async def _apply_decision(
        self, marathon_state_id: str, state: Dict, agent_result: Dict
    ) -> Dict[str, Any]:
        """Apply the agent's decision to the marathon state."""
        decision = agent_result.get("decision")
        confidence = agent_result.get("confidence", 0.5)
        new_signature = agent_result.get("updated_thought_signature", {})
        reasoning = agent_result.get("reasoning", "")

        # Parse old signature
        old_signature = (
            json.loads(state["thought_signature"])
            if isinstance(state["thought_signature"], str)
            else state["thought_signature"]
        )

        # Detect corrections
        corrections = self._detect_corrections(old_signature, new_signature)
        correction_count = len(corrections)

        # Record decision in database
        await db.execute(
            """
            INSERT INTO marathon_agent_decisions
            (marathon_state_id, stage, decision_type, reasoning, confidence,
             previous_thought_signature, new_thought_signature)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            marathon_state_id,
            state["current_stage"],
            decision,
            reasoning,
            confidence,
            json.dumps(old_signature),
            json.dumps(new_signature),
        )

        # Update marathon state based on decision
        if decision == "advance":
            await self._advance_to_next_stage(marathon_state_id, new_signature, confidence)
        elif decision == "reject":
            await self._reject_candidate(marathon_state_id, new_signature, reasoning)
        elif decision == "escalate":
            await self._escalate_to_human(marathon_state_id, new_signature, reasoning)
        elif decision == "hold":
            await self._hold_for_more_data(marathon_state_id, new_signature, reasoning)

        # Update correction count if any corrections were made
        if correction_count > 0:
            await db.execute(
                """
                UPDATE marathon_agent_state
                SET correction_count = correction_count + $1,
                    last_correction_at = NOW()
                WHERE id = $2
                """,
                correction_count,
                marathon_state_id,
            )

        return {
            "decision": decision,
            "confidence": confidence,
            "reasoning": reasoning,
            "corrections": corrections,
            "next_action": agent_result.get("next_action", ""),
        }

    def _detect_corrections(self, old_signature: Dict, new_signature: Dict) -> List[Dict]:
        """Detect if the agent changed its mind about something."""
        corrections = []

        # Check explicit self-corrections in new signature
        if "self_corrections" in new_signature:
            new_corrections = new_signature.get("self_corrections", [])
            old_corrections = old_signature.get("self_corrections", [])

            # Get only the new corrections
            corrections = new_corrections[len(old_corrections) :]

        # Also check for confidence drops
        old_conf = old_signature.get("decision_confidence", 0.5)
        new_conf = new_signature.get("decision_confidence", 0.5)

        if old_conf - new_conf > 0.2:
            corrections.append(
                {
                    "type": "confidence_drop",
                    "old_confidence": old_conf,
                    "new_confidence": new_conf,
                    "reason": "Significant confidence decrease detected",
                }
            )

        return corrections

    async def _advance_to_next_stage(
        self, marathon_state_id: str, thought_signature: Dict, confidence: float
    ):
        """Advance candidate to next stage automatically."""
        # Define stage progression
        stage_map = {
            "screening": "phone_screen",
            "phone_screen": "assessment",
            "assessment": "offer",
        }

        state = await db.execute(
            "SELECT current_stage FROM marathon_agent_state WHERE id = $1", marathon_state_id
        )

        next_stage = stage_map.get(state["current_stage"])

        if next_stage:
            await db.execute(
                """
                UPDATE marathon_agent_state
                SET current_stage = $1,
                    stage_status = 'pending',
                    thought_signature = $2,
                    decision_confidence = $3,
                    can_auto_advance = true,
                    next_scheduled_action = $4,
                    last_agent_action = 'advance',
                    updated_at = NOW()
                WHERE id = $5
                """,
                next_stage,
                json.dumps(thought_signature),
                confidence,
                datetime.utcnow() + timedelta(days=1),  # Check again in 1 day
                marathon_state_id,
            )

            await self._record_event(
                marathon_state_id, "candidate_advanced", {"from_stage": state["current_stage"], "to_stage": next_stage}
            )
        else:
            # Reached final stage
            await db.execute(
                """
                UPDATE marathon_agent_state
                SET stage_status = 'completed',
                    thought_signature = $1,
                    decision_confidence = $2,
                    last_agent_action = 'complete',
                    updated_at = NOW()
                WHERE id = $3
                """,
                json.dumps(thought_signature),
                confidence,
                marathon_state_id,
            )

    async def _reject_candidate(self, marathon_state_id: str, thought_signature: Dict, reasoning: str):
        """Reject the candidate."""
        await db.execute(
            """
            UPDATE marathon_agent_state
            SET stage_status = 'completed',
                thought_signature = $1,
                last_agent_action = 'reject',
                last_agent_reasoning = $2,
                updated_at = NOW()
            WHERE id = $3
            """,
            json.dumps(thought_signature),
            reasoning,
            marathon_state_id,
        )

        await self._record_event(marathon_state_id, "candidate_rejected", {"reasoning": reasoning})

    async def _escalate_to_human(self, marathon_state_id: str, thought_signature: Dict, reasoning: str):
        """Escalate to human review."""
        await db.execute(
            """
            UPDATE marathon_agent_state
            SET stage_status = 'escalated',
                thought_signature = $1,
                requires_human_review = true,
                escalation_reason = $2,
                last_agent_action = 'escalate',
                updated_at = NOW()
            WHERE id = $3
            """,
            json.dumps(thought_signature),
            reasoning,
            marathon_state_id,
        )

        await self._record_event(marathon_state_id, "escalated_to_human", {"reasoning": reasoning})

    async def _hold_for_more_data(self, marathon_state_id: str, thought_signature: Dict, reasoning: str):
        """Hold the marathon until more data is available."""
        await db.execute(
            """
            UPDATE marathon_agent_state
            SET stage_status = 'blocked',
                thought_signature = $1,
                blocked_reason = $2,
                last_agent_action = 'hold',
                next_scheduled_action = $3,
                updated_at = NOW()
            WHERE id = $4
            """,
            json.dumps(thought_signature),
            reasoning,
            datetime.utcnow() + timedelta(days=3),  # Check again in 3 days
            marathon_state_id,
        )

        await self._record_event(marathon_state_id, "held_for_more_data", {"reasoning": reasoning})

    async def _record_event(self, marathon_state_id: str, event_type: str, event_data: Dict):
        """Record an event in the audit trail."""
        await db.execute(
            """
            INSERT INTO marathon_agent_events
            (marathon_state_id, event_type, event_data)
            VALUES ($1, $2, $3)
            """,
            marathon_state_id,
            event_type,
            json.dumps(event_data),
        )

    async def get_marathons_requiring_review(self) -> List[Dict]:
        """Get all marathons that require human review."""
        results = await db.execute(
            """
            SELECT
                m.*,
                j.title as job_title,
                j.department,
                a.stage as application_stage
            FROM marathon_agent_state m
            JOIN jobs j ON m.job_id = j.id
            LEFT JOIN applications a ON m.application_id = a.id
            WHERE m.requires_human_review = true
                AND m.stage_status = 'escalated'
            ORDER BY m.created_at DESC
            """
        )

        return results or []

    async def get_active_marathons(self, limit: int = 50) -> List[Dict]:
        """Get all active marathon processes."""
        results = await db.execute(
            """
            SELECT
                m.*,
                j.title as job_title,
                j.department,
                a.stage as application_stage
            FROM marathon_agent_state m
            JOIN jobs j ON m.job_id = j.id
            LEFT JOIN applications a ON m.application_id = a.id
            WHERE m.stage_status IN ('pending', 'in_progress', 'blocked')
            ORDER BY m.next_scheduled_action ASC
            LIMIT $1
            """,
            limit,
        )

        return results or []


# Global marathon agent instance
marathon_agent = MarathonHiringAgent()
