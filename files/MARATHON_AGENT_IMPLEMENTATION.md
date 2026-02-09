# Marathon Agent Implementation Plan

## Overview

The Marathon Agent is an autonomous hiring orchestrator that manages multi-day/week hiring processes using Gemini 3's Thought Signatures and Thinking Levels. It maintains context across all stages, self-corrects when new information contradicts earlier decisions, and progresses candidates autonomously.

---

## Core Concepts

### 1. Thought Signatures
Persistent "memory" that follows a candidate through their entire journey:

```python
ThoughtSignature = {
    "candidate_id": "uuid",
    "core_strengths": [
        "Excellent Python skills",
        "Strong system design thinking",
        "Great communication"
    ],
    "concerns": [
        "Limited Kubernetes experience",
        "No startup background"
    ],
    "hiring_thesis": "Strong technical fit despite infrastructure gaps. Can learn K8s quickly.",
    "decision_confidence": 0.85,
    "stage_insights": {
        "screening": {...},
        "phone_screen": {...},
        "assessment": {...}
    },
    "self_corrections": [
        {
            "stage": "assessment",
            "original_belief": "Communication skills were strong",
            "correction": "Video shows nervousness, needs more coaching",
            "impact": "Lower confidence from 0.85 to 0.72"
        }
    ]
}
```

### 2. Thinking Levels
Multi-step reasoning for complex hiring decisions:

- **Level 1**: Surface analysis (resume keywords, years of experience)
- **Level 2**: Contextual reasoning (startup vs enterprise background, career trajectory)
- **Level 3**: Strategic thinking (culture fit, growth potential, team dynamics)

### 3. Autonomous Progression
Agent decides when to move candidates forward without human approval:

```python
progression_rules = {
    "auto_advance_if": {
        "screening_score": "> 80 AND no critical concerns",
        "phone_screen": "all_green_flags AND decision_confidence > 0.8",
        "assessment": "strong_yes AND no_red_flags"
    },
    "auto_reject_if": {
        "screening_score": "< 40",
        "phone_screen": "critical_red_flag OR decision_confidence < 0.3"
    },
    "escalate_to_human_if": {
        "decision_confidence": "< 0.6 OR conflicting_signals"
    }
}
```

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Marathon Agent                            │
│  (Gemini 3 with Thought Signatures + Thinking Levels)       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  State Store  │   │  Job Queue    │   │  Monitoring   │
│  (Supabase)   │   │  (Background) │   │  Dashboard    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ JD Assist     │   │ Screener      │   │ Assessor      │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Database Schema

```sql
-- New table for Marathon Agent state
CREATE TABLE marathon_agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    candidate_id UUID REFERENCES candidates(id),

    -- Thought Signature
    thought_signature JSONB NOT NULL,
    decision_confidence FLOAT NOT NULL,

    -- Current state
    current_stage TEXT NOT NULL, -- 'sourcing', 'screening', 'phone', 'assessment', 'offer'
    stage_status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'blocked'

    -- Progression rules
    can_auto_advance BOOLEAN DEFAULT false,
    requires_human_review BOOLEAN DEFAULT false,
    blocked_reason TEXT,

    -- Self-correction tracking
    correction_count INT DEFAULT 0,
    last_correction_at TIMESTAMPTZ,

    -- Agent metadata
    agent_run_id TEXT,
    last_agent_action TEXT,
    next_scheduled_action TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marathon_next_action ON marathon_agent_state(next_scheduled_action)
    WHERE stage_status != 'completed';

-- Track all agent decisions
CREATE TABLE marathon_agent_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marathon_state_id UUID REFERENCES marathon_agent_state(id),

    stage TEXT NOT NULL,
    decision_type TEXT NOT NULL, -- 'advance', 'reject', 'escalate', 'self_correct'
    reasoning TEXT NOT NULL,
    confidence FLOAT NOT NULL,

    -- What changed
    previous_thought_signature JSONB,
    new_thought_signature JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Plan

### Phase 1: Core Marathon Agent (Week 1-2)

#### 1.1 Create Marathon Agent Class

```python
# backend/app/agents/marathon_agent.py
from datetime import datetime, timedelta
from typing import Any, Dict, List
from google.adk.agents import LlmAgent
from app.services.supabase import db

class MarathonHiringAgent:
    """
    Autonomous multi-day hiring agent with Thought Signatures.
    """

    def __init__(self):
        self.agent = LlmAgent(
            name="marathon_hiring_orchestrator",
            model="gemini-2.5-pro",
            description="Orchestrates multi-day hiring processes with continuity",
            instruction=self._get_instruction(),
            thinking_levels=3,  # Deep reasoning
            tools=[
                self.update_thought_signature,
                self.evaluate_progression,
                self.self_correct,
                self.schedule_next_action
            ]
        )

    def _get_instruction(self) -> str:
        return """
        You are the Marathon Hiring Agent, orchestrating hiring processes over days/weeks.

        THOUGHT SIGNATURES: Your memory across stages
        - Maintain a "hiring thesis" for each candidate
        - Track core strengths and concerns continuously
        - Update beliefs as new information emerges

        THINKING LEVELS: Use 3-level reasoning
        - Level 1: Analyze current stage data (resume, interview)
        - Level 2: Compare with previous stages, check consistency
        - Level 3: Strategic assessment (culture fit, team needs, growth potential)

        SELF-CORRECTION: When new data contradicts earlier beliefs
        1. Acknowledge the contradiction explicitly
        2. Re-evaluate the earlier decision
        3. Update thought signature with correction
        4. Adjust decision confidence

        AUTONOMOUS PROGRESSION:
        - Auto-advance if: score > 80 AND no critical concerns AND confidence > 0.8
        - Auto-reject if: score < 40 OR critical red flag
        - Escalate if: conflicting signals OR confidence < 0.6

        MULTI-DAY CONTINUITY:
        - Remember context from days/weeks ago
        - Maintain consistent evaluation criteria
        - Don't repeat questions candidates already answered
        """

    async def start_marathon(self, job_id: str, candidate_id: str) -> Dict[str, Any]:
        """Initialize a marathon hiring process for a candidate."""

        # Create initial thought signature
        job = await db.get_job(job_id)
        candidate = await db.get_candidate(candidate_id)

        initial_signature = {
            "candidate_id": candidate_id,
            "job_id": job_id,
            "core_strengths": [],
            "concerns": [],
            "hiring_thesis": "To be developed after screening",
            "decision_confidence": 0.5,
            "stage_insights": {},
            "self_corrections": []
        }

        # Store in database
        marathon_state = await db.execute("""
            INSERT INTO marathon_agent_state
            (job_id, candidate_id, thought_signature, decision_confidence,
             current_stage, stage_status, next_scheduled_action)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        """, job_id, candidate_id, initial_signature, 0.5,
            "screening", "pending", datetime.utcnow())

        return marathon_state

    async def process_stage(self, marathon_state_id: str) -> Dict[str, Any]:
        """Process current stage and decide next action."""

        # Load state
        state = await db.execute("""
            SELECT * FROM marathon_agent_state WHERE id = $1
        """, marathon_state_id)

        thought_signature = state["thought_signature"]
        current_stage = state["current_stage"]

        # Run agent with context
        result = await self.agent.run({
            "thought_signature": thought_signature,
            "current_stage": current_stage,
            "stage_data": await self._get_stage_data(state)
        })

        # Extract decisions
        new_signature = result.get("updated_thought_signature")
        decision = result.get("decision")  # 'advance', 'reject', 'escalate'
        confidence = result.get("confidence")
        reasoning = result.get("reasoning")

        # Check for self-corrections
        corrections = self._detect_corrections(thought_signature, new_signature)

        # Update state
        await self._update_marathon_state(
            marathon_state_id,
            new_signature,
            decision,
            confidence,
            corrections
        )

        # Record decision
        await db.execute("""
            INSERT INTO marathon_agent_decisions
            (marathon_state_id, stage, decision_type, reasoning, confidence,
             previous_thought_signature, new_thought_signature)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, marathon_state_id, current_stage, decision, reasoning,
            confidence, thought_signature, new_signature)

        # Execute decision
        if decision == "advance":
            await self._advance_to_next_stage(marathon_state_id)
        elif decision == "reject":
            await self._reject_candidate(marathon_state_id, reasoning)
        elif decision == "escalate":
            await self._escalate_to_human(marathon_state_id, reasoning)

        return {
            "decision": decision,
            "confidence": confidence,
            "reasoning": reasoning,
            "corrections": corrections
        }

    def _detect_corrections(
        self,
        old_signature: Dict,
        new_signature: Dict
    ) -> List[Dict]:
        """Detect if agent changed its mind about something."""
        corrections = []

        # Check if strengths became concerns
        for strength in old_signature.get("core_strengths", []):
            if strength in new_signature.get("concerns", []):
                corrections.append({
                    "type": "strength_to_concern",
                    "item": strength,
                    "reason": "New evidence contradicts earlier assessment"
                })

        # Check if confidence dropped significantly
        old_conf = old_signature.get("decision_confidence", 0.5)
        new_conf = new_signature.get("decision_confidence", 0.5)
        if old_conf - new_conf > 0.2:
            corrections.append({
                "type": "confidence_drop",
                "old_confidence": old_conf,
                "new_confidence": new_conf,
                "reason": "New stage revealed concerns"
            })

        return corrections

    async def _advance_to_next_stage(self, marathon_state_id: str):
        """Move candidate to next stage autonomously."""
        stage_progression = {
            "screening": "phone_screen",
            "phone_screen": "assessment",
            "assessment": "offer"
        }

        state = await db.execute("""
            SELECT current_stage FROM marathon_agent_state WHERE id = $1
        """, marathon_state_id)

        next_stage = stage_progression.get(state["current_stage"])

        if next_stage:
            await db.execute("""
                UPDATE marathon_agent_state
                SET current_stage = $1,
                    stage_status = 'pending',
                    next_scheduled_action = $2,
                    updated_at = NOW()
                WHERE id = $3
            """, next_stage, datetime.utcnow() + timedelta(hours=24),
                marathon_state_id)

            # Trigger next stage action (e.g., send assessment link)
            await self._trigger_stage_action(marathon_state_id, next_stage)
```

#### 1.2 Background Job Processor

```python
# backend/app/workers/marathon_worker.py
import asyncio
from datetime import datetime
from app.agents.marathon_agent import MarathonHiringAgent

async def process_marathon_queue():
    """Background worker that processes scheduled marathon actions."""

    agent = MarathonHiringAgent()

    while True:
        # Find all states ready for processing
        pending_states = await db.execute("""
            SELECT id FROM marathon_agent_state
            WHERE stage_status = 'pending'
              AND next_scheduled_action <= NOW()
              AND current_stage != 'offer'
            ORDER BY next_scheduled_action
            LIMIT 10
        """)

        for state in pending_states:
            try:
                # Mark as in progress
                await db.execute("""
                    UPDATE marathon_agent_state
                    SET stage_status = 'in_progress'
                    WHERE id = $1
                """, state["id"])

                # Process
                result = await agent.process_stage(state["id"])

                print(f"Marathon processed: {state['id']} -> {result['decision']}")

            except Exception as e:
                print(f"Error processing marathon {state['id']}: {e}")
                await db.execute("""
                    UPDATE marathon_agent_state
                    SET stage_status = 'blocked',
                        blocked_reason = $1
                    WHERE id = $2
                """, str(e), state["id"])

        # Wait before checking again
        await asyncio.sleep(60)  # Check every minute

# Start worker
if __name__ == "__main__":
    asyncio.run(process_marathon_queue())
```

---

### Phase 2: Self-Correction Mechanisms (Week 2-3)

#### 2.1 Implement Contradiction Detection

```python
class SelfCorrectionEngine:
    """Detects and handles contradictions in hiring decisions."""

    async def check_for_contradictions(
        self,
        thought_signature: Dict,
        new_stage_data: Dict
    ) -> List[Dict]:
        """
        Compare new stage data with existing thought signature.
        Identify contradictions that require correction.
        """
        contradictions = []

        # Example: Screening said "great communicator"
        # but video shows poor communication
        if "great communicator" in thought_signature.get("core_strengths", []):
            if new_stage_data.get("communication_score", 100) < 60:
                contradictions.append({
                    "original_belief": "Strong communication skills",
                    "new_evidence": f"Video assessment scored {new_stage_data['communication_score']}/100",
                    "severity": "high",
                    "requires_reevaluation": True
                })

        # Example: Resume showed "10 years Python"
        # but coding assessment reveals basic knowledge
        if thought_signature.get("years_experience", 0) > 8:
            if new_stage_data.get("coding_proficiency") == "junior":
                contradictions.append({
                    "original_belief": "Senior-level engineer",
                    "new_evidence": "Coding assessment shows junior-level skills",
                    "severity": "critical",
                    "requires_reevaluation": True
                })

        return contradictions

    async def apply_correction(
        self,
        marathon_state_id: str,
        contradiction: Dict
    ):
        """Apply self-correction to thought signature."""

        state = await db.execute("""
            SELECT * FROM marathon_agent_state WHERE id = $1
        """, marathon_state_id)

        thought_signature = state["thought_signature"]

        # Add to self-corrections history
        thought_signature["self_corrections"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "stage": state["current_stage"],
            "original_belief": contradiction["original_belief"],
            "correction": contradiction["new_evidence"],
            "impact": self._calculate_impact(contradiction)
        })

        # Lower confidence if critical
        if contradiction["severity"] == "critical":
            thought_signature["decision_confidence"] *= 0.7

        # Update database
        await db.execute("""
            UPDATE marathon_agent_state
            SET thought_signature = $1,
                decision_confidence = $2,
                correction_count = correction_count + 1,
                last_correction_at = NOW()
            WHERE id = $3
        """, thought_signature,
            thought_signature["decision_confidence"],
            marathon_state_id)
```

---

### Phase 3: Monitoring Dashboard (Week 3-4)

#### 3.1 Frontend Dashboard

```typescript
// frontend/app/(dashboard)/marathon/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Clock, TrendingDown, AlertTriangle } from "lucide-react";

interface MarathonState {
  id: string;
  candidate_name: string;
  job_title: string;
  current_stage: string;
  decision_confidence: number;
  correction_count: number;
  next_scheduled_action: string;
  thought_signature: any;
}

export default function MarathonDashboard() {
  const [activeMarathons, setActiveMarathons] = useState<MarathonState[]>([]);

  useEffect(() => {
    const fetchMarathons = async () => {
      const response = await fetch("/api/v1/marathon/active");
      setActiveMarathons(await response.json());
    };

    fetchMarathons();
    const interval = setInterval(fetchMarathons, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">🏃‍♂️ Marathon Agent Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Active Marathons"
          value={activeMarathons.length}
          icon={<Clock />}
        />
        <MetricCard
          title="Self-Corrections Today"
          value={activeMarathons.reduce((sum, m) => sum + m.correction_count, 0)}
          icon={<TrendingDown />}
        />
        <MetricCard
          title="Escalations Needed"
          value={activeMarathons.filter(m => m.decision_confidence < 0.6).length}
          icon={<AlertTriangle />}
        />
      </div>

      <div className="space-y-4">
        {activeMarathons.map((marathon) => (
          <MarathonCard key={marathon.id} marathon={marathon} />
        ))}
      </div>
    </div>
  );
}

function MarathonCard({ marathon }: { marathon: MarathonState }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{marathon.candidate_name}</h3>
          <p className="text-sm text-slate-600">{marathon.job_title}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
            {marathon.current_stage}
          </span>

          <ConfidenceBadge confidence={marathon.decision_confidence} />
        </div>
      </div>

      {/* Thought Signature Summary */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">✅ Strengths</h4>
          <ul className="text-sm space-y-1">
            {marathon.thought_signature.core_strengths.map((s: string, idx: number) => (
              <li key={idx} className="text-green-700">• {s}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">⚠️ Concerns</h4>
          <ul className="text-sm space-y-1">
            {marathon.thought_signature.concerns.map((c: string, idx: number) => (
              <li key={idx} className="text-amber-700">• {c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Self-Corrections */}
      {marathon.correction_count > 0 && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-sm font-medium text-amber-900">
            🔄 {marathon.correction_count} self-corrections made
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Agent adjusted beliefs based on new evidence
          </p>
        </div>
      )}

      {/* Next Action */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Next action: <span className="font-medium">{new Date(marathon.next_scheduled_action).toLocaleString()}</span>
        </p>

        {marathon.decision_confidence < 0.6 && (
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
            Review & Decide
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Explanation of Other Concepts

### 🎵 Vibe Engineering

**What It Does:**
- Agents don't just write code, they verify it through autonomous testing loops
- Keeps running tests until confident the code is correct
- Uses browser-based verification for UI components

**Implementation in Telentic:**

```python
# Use Case: Verify technical assessment submissions
async def verify_coding_challenge(submission: str, requirements: dict) -> dict:
    agent = LlmAgent(
        name="code_verifier",
        model="gemini-2.5-flash",
        instruction="""
        Verify this code meets all requirements.

        VERIFICATION LOOP:
        1. Generate test cases from requirements
        2. Execute code in sandbox
        3. Run tests and analyze results
        4. If confidence < 0.9, generate more tests
        5. Repeat until confidence >= 0.9 or max 5 loops

        Return: verification_artifacts with test results
        """
    )

    return await agent.run({
        "code": submission,
        "requirements": requirements,
        "max_verification_loops": 5
    })
```

**Benefits:**
- Candidates get instant, reliable feedback
- Reduces manual code review time
- Catches edge cases human reviewers might miss

---

### 👨‍🏫 Real-Time Teacher

**What It Does:**
- Uses Gemini Live API to synthesize real-time video/audio feedback
- Provides adaptive coaching during assessments
- Adjusts difficulty based on candidate performance

**Implementation in Telentic:**

```python
# Use Case: Live interview coaching for candidates
@router.websocket("/api/v1/assess/live/{assessment_id}")
async def live_assessment_coach(websocket: WebSocket, assessment_id: str):
    await websocket.accept()

    assessment = await db.get_assessment(assessment_id)

    # Stream to Gemini Live API
    async for audio_video_chunk in websocket.iter_bytes():

        # Get real-time coaching
        coaching = await gemini_live.synthesize(
            audio_video_chunk,
            context={
                "question": assessment["current_question"],
                "expected_answer": assessment["expected_answer"],
                "candidate_level": "mid_senior"
            },
            prompt="""
            Provide real-time coaching:
            - If candidate is struggling, give a hint
            - If candidate is off-topic, gently redirect
            - If candidate is doing well, ask follow-up
            - Adjust tone to be encouraging but honest
            """
        )

        await websocket.send_json({
            "coaching_text": coaching.text,
            "tone_adjustment": coaching.tone,
            "difficulty_adjustment": coaching.suggested_difficulty
        })
```

**Benefits:**
- Candidates feel supported during high-pressure assessments
- Identifies candidates who respond well to coaching (growth mindset)
- Creates a more human, less robotic assessment experience

---

### 🎨 Creative Autopilot

**What It Does:**
- Combines Gemini 3 reasoning with high-quality image generation
- Uses Paint-to-Edit for precise visual control
- Generates professional, brand-consistent assets

**Implementation in Telentic:**

```python
# Use Case: Generate branded job postings with visuals
async def generate_creative_job_posting(job: Job) -> dict:
    agent = LlmAgent(
        name="creative_jd_designer",
        model="gemini-2.5-pro",
        instruction="""
        Create a visually stunning, brand-consistent job posting.

        Steps:
        1. Analyze job requirements and company brand
        2. Generate hero image concept (office vibes, team culture)
        3. Design infographic for benefits (salary, perks, growth)
        4. Create social media card (1080x1080) for LinkedIn
        5. Output styled HTML/CSS for web posting
        6. Generate PDF for formal distribution

        Brand Guidelines:
        - Primary Color: #6366F1 (indigo)
        - Font: Inter for body, Space Grotesk for headings
        - Style: Modern, tech-forward, inclusive
        """
    )

    creative_assets = await agent.run({
        "job_data": job.dict(),
        "company_brand": await get_brand_guidelines()
    })

    return {
        "hero_image_url": creative_assets["hero_image"],
        "benefits_infographic_url": creative_assets["infographic"],
        "social_card_url": creative_assets["social_card"],
        "styled_html": creative_assets["html"],
        "pdf_url": creative_assets["pdf"]
    }
```

**Benefits:**
- Jobs look more attractive to candidates
- Consistent employer branding across platforms
- Saves design team hours per job posting

---

## Timeline

### Month 1: Marathon Agent Foundation
- **Week 1-2**: Core agent, state persistence, basic progression
- **Week 3**: Self-correction mechanisms
- **Week 4**: Monitoring dashboard, testing

### Month 2: Vibe Engineering
- **Week 1-2**: Code verification system for technical assessments
- **Week 3-4**: Integration with assessment flow, testing

### Month 3: Creative Autopilot
- **Week 1-2**: Job posting design automation
- **Week 3-4**: Offer letter design, social media assets

### Month 4: Real-Time Teacher
- **Week 1-3**: Gemini Live API integration, WebSocket infrastructure
- **Week 4**: Testing with real candidates, feedback gathering

---

## Success Metrics

### Marathon Agent
- **Time-to-hire reduced by 40%** (autonomous progression)
- **Decision reversal rate < 5%** (self-correction working)
- **Recruiter intervention rate < 15%** (high confidence decisions)

### Vibe Engineering
- **Code review time reduced by 60%**
- **False positive rate < 10%** (accurate verification)

### Real-Time Teacher
- **Candidate satisfaction score > 4.5/5**
- **Assessment completion rate increased by 30%**

### Creative Autopilot
- **Job posting engagement increased by 50%**
- **Design time reduced from 2 hours to 5 minutes**

---

## Risk Mitigation

1. **Marathon Agent makes bad decisions autonomously**
   - Solution: Start with low auto-advance threshold (confidence > 0.9)
   - Human review for first 100 decisions
   - Gradually increase autonomy as accuracy improves

2. **Self-corrections create confusion**
   - Solution: Clear audit trail of all corrections
   - Notify recruiters when major corrections happen

3. **Real-Time coaching feels robotic**
   - Solution: Extensive testing with diverse candidates
   - Feedback loop to improve coaching prompts

4. **Creative assets don't match brand**
   - Solution: Strict brand guidelines in prompts
   - Human approval for first 50 designs
   - Fine-tune based on feedback
