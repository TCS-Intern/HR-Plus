# Agent Specifications

## Overview

This document defines the four AI agents that power the Autonomous Talent Acquisition Platform. Each agent is built using Google ADK with Gemini 2.5 (`gemini-2.5-flash` for speed, `gemini-2.5-pro-preview-03-25` for complex reasoning) as the underlying model.

---

## Agent 1: JD Assist Agent

### Purpose
Transform voice or text input from hiring managers into structured, complete job descriptions with skills matrices and evaluation criteria.

### Trigger Conditions
- User initiates "Create New Job"
- User uploads existing JD for enhancement
- User provides voice/text requirements

### Input Schema
```json
{
  "input_type": "voice" | "text" | "document",
  "content": "string (transcribed voice or raw text)",
  "document_url": "string (optional, for uploaded JDs)",
  "context": {
    "department": "string (optional)",
    "hiring_manager": "string",
    "urgency": "normal" | "urgent",
    "company_id": "uuid"
  }
}
```

### Output Schema
```json
{
  "job_description": {
    "title": "string",
    "department": "string",
    "location": "string",
    "job_type": "full-time" | "part-time" | "contract",
    "remote_policy": "remote" | "hybrid" | "onsite",
    "summary": "string (2-3 sentences)",
    "responsibilities": ["string"],
    "qualifications": {
      "required": ["string"],
      "preferred": ["string"]
    },
    "salary_range": {
      "min": "number",
      "max": "number",
      "currency": "string"
    }
  },
  "skills_matrix": {
    "required": [
      {
        "skill": "string",
        "proficiency": "basic" | "intermediate" | "advanced" | "expert",
        "weight": "number (0-1)"
      }
    ],
    "nice_to_have": [
      {
        "skill": "string",
        "proficiency": "string",
        "weight": "number"
      }
    ]
  },
  "evaluation_criteria": [
    {
      "criterion": "string",
      "weight": "number (0-100)",
      "description": "string",
      "assessment_method": "interview" | "technical" | "behavioral" | "portfolio"
    }
  ],
  "suggested_questions": {
    "technical": ["string"],
    "behavioral": ["string"],
    "situational": ["string"]
  }
}
```

### Tools
```python
tools = [
    Tool(
        name="search_similar_jds",
        description="Search internal database for similar job descriptions",
        parameters={
            "keywords": "list[str]",
            "department": "str",
            "limit": "int"
        }
    ),
    Tool(
        name="get_market_salary_data",
        description="Fetch market salary data for a role and location",
        parameters={
            "job_title": "str",
            "location": "str",
            "experience_level": "str"
        }
    ),
    Tool(
        name="get_company_policies",
        description="Retrieve company HR policies (benefits, remote work, etc.)",
        parameters={
            "company_id": "str",
            "policy_types": "list[str]"
        }
    )
]
```

### System Prompt
```
You are the JD Assist Agent, an expert HR consultant specializing in creating compelling, 
accurate job descriptions that attract top talent.

YOUR RESPONSIBILITIES:
1. Parse voice or text input to understand the hiring manager's requirements
2. Structure requirements into a complete, professional job description
3. Create a weighted skills matrix for candidate evaluation
4. Define clear, measurable evaluation criteria
5. Suggest relevant interview questions

GUIDELINES:
- Use clear, inclusive language (avoid gendered terms, jargon)
- Be specific about requirements vs nice-to-haves
- Include realistic salary ranges based on market data
- Create evaluation criteria that are objective and measurable
- Ensure compliance with employment laws (no discriminatory requirements)

OUTPUT FORMAT:
Always respond with valid JSON matching the output schema. Do not include any text
outside the JSON structure.

QUALITY STANDARDS:
- Job titles should be industry-standard and searchable
- Responsibilities should start with action verbs
- Required skills should be truly required (not wishlists)
- Evaluation criteria should map to skills being assessed
```

---

## Agent 2: Talent Screener Agent

### Purpose
Analyze CVs and candidate profiles against job requirements to produce ranked, scored candidate lists with detailed match explanations.

### Trigger Conditions
- New CVs uploaded for a job
- LinkedIn search results received
- Manual candidate addition
- Batch re-screening requested

### Input Schema
```json
{
  "job_id": "uuid",
  "job_data": {
    "title": "string",
    "skills_matrix": {},
    "evaluation_criteria": [],
    "requirements": {}
  },
  "candidates": [
    {
      "candidate_id": "uuid",
      "resume_url": "string",
      "resume_parsed": {},
      "linkedin_data": {}
    }
  ],
  "screening_config": {
    "min_match_threshold": "number (0-100)",
    "prioritize_skills": ["string"],
    "exclude_if_missing": ["string"]
  }
}
```

### Output Schema
```json
{
  "screening_results": [
    {
      "candidate_id": "uuid",
      "overall_score": "number (0-100)",
      "match_breakdown": {
        "required_skills_match": "number",
        "nice_to_have_match": "number",
        "experience_match": "number",
        "education_match": "number"
      },
      "skill_analysis": [
        {
          "skill": "string",
          "required": "boolean",
          "found": "boolean",
          "evidence": "string (quote from CV)",
          "proficiency_estimate": "string"
        }
      ],
      "experience_summary": {
        "total_years": "number",
        "relevant_years": "number",
        "key_experiences": ["string"]
      },
      "strengths": ["string"],
      "gaps": ["string"],
      "red_flags": ["string"],
      "recommendation": "strong_match" | "good_match" | "partial_match" | "weak_match",
      "notes": "string"
    }
  ],
  "summary": {
    "total_screened": "number",
    "strong_matches": "number",
    "good_matches": "number",
    "recommended_for_assessment": ["uuid"]
  }
}
```

### Tools
```python
tools = [
    Tool(
        name="parse_resume",
        description="Extract structured data from a resume document",
        parameters={
            "document_url": "str",
            "format": "str (pdf, docx)"
        }
    ),
    Tool(
        name="enrich_linkedin_profile",
        description="Fetch additional data from LinkedIn profile",
        parameters={
            "linkedin_url": "str"
        }
    ),
    Tool(
        name="verify_credentials",
        description="Verify education and certification claims",
        parameters={
            "candidate_id": "str",
            "credentials": "list[dict]"
        }
    ),
    Tool(
        name="check_previous_applications",
        description="Check if candidate has applied before",
        parameters={
            "email": "str",
            "company_id": "str"
        }
    )
]
```

### System Prompt
```
You are the Talent Screener Agent, an expert technical recruiter with deep experience
in evaluating candidates across multiple industries and roles.

YOUR RESPONSIBILITIES:
1. Parse and analyze candidate resumes thoroughly
2. Match candidate qualifications against job requirements
3. Score candidates objectively based on the skills matrix
4. Identify strengths, gaps, and potential red flags
5. Rank candidates by fit and provide clear recommendations

SCREENING PRINCIPLES:
- Be thorough but fair - look for transferable skills
- Don't penalize non-linear career paths
- Consider potential, not just current state
- Flag genuine concerns, not minor formatting issues
- Explain your reasoning clearly

SCORING METHODOLOGY:
- Required skills: Each matched skill contributes weighted points
- Nice-to-have: Bonus points, but don't penalize absence
- Experience: Compare against stated requirements
- Education: Match if specified, otherwise don't weight heavily

RED FLAGS TO WATCH FOR:
- Unexplained employment gaps (>1 year)
- Inconsistencies between CV and LinkedIn
- Skills claimed without evidence
- Very short tenures (<1 year) at multiple companies

OUTPUT FORMAT:
Always respond with valid JSON matching the output schema. Provide evidence 
(direct quotes or specific references) for all assessments.
```

---

## Agent 3: Talent Assessor Agent

### Purpose
Generate role-specific assessment questions, analyze video responses (including behavioral signals), and produce comprehensive candidate evaluation reports.

### Trigger Conditions
- Candidates approved for assessment
- Assessment session completed (video submitted)
- Re-analysis requested

### Input Schema (Question Generation)
```json
{
  "mode": "generate_questions",
  "job_id": "uuid",
  "job_data": {
    "title": "string",
    "skills_matrix": {},
    "evaluation_criteria": [],
    "responsibilities": []
  },
  "candidate_context": {
    "candidate_id": "uuid",
    "resume_summary": {},
    "screening_results": {}
  },
  "assessment_config": {
    "question_count": "number",
    "time_per_question_seconds": "number",
    "include_technical": "boolean",
    "include_behavioral": "boolean",
    "include_situational": "boolean",
    "difficulty_level": "junior" | "mid" | "senior" | "lead"
  }
}
```

### Input Schema (Video Analysis)
```json
{
  "mode": "analyze_video",
  "assessment_id": "uuid",
  "video_url": "string",
  "questions": [
    {
      "question_id": "string",
      "question_text": "string",
      "expected_topics": ["string"],
      "time_limit_seconds": "number"
    }
  ],
  "job_requirements": {},
  "analysis_config": {
    "analyze_content": true,
    "analyze_communication": true,
    "analyze_behavioral": true,
    "behavioral_analysis_enabled": true
  }
}
```

### Output Schema (Questions)
```json
{
  "assessment_questions": [
    {
      "question_id": "string",
      "question_type": "technical" | "behavioral" | "situational",
      "question_text": "string",
      "follow_up_prompts": ["string"],
      "time_limit_seconds": "number",
      "evaluation_rubric": {
        "excellent": "string (what excellent looks like)",
        "good": "string",
        "adequate": "string",
        "poor": "string"
      },
      "key_topics_to_cover": ["string"],
      "related_skills": ["string"]
    }
  ],
  "assessment_instructions": {
    "candidate_intro": "string",
    "time_management_tips": "string",
    "technical_requirements": "string"
  }
}
```

### Output Schema (Analysis)
```json
{
  "assessment_analysis": {
    "overall_score": "number (0-100)",
    "recommendation": "STRONG_YES" | "YES" | "MAYBE" | "NO",
    "confidence_level": "high" | "medium" | "low",
    
    "response_analysis": [
      {
        "question_id": "string",
        "score": "number (1-10)",
        "strengths": ["string"],
        "weaknesses": ["string"],
        "key_points_mentioned": ["string"],
        "missed_topics": ["string"],
        "notable_moments": [
          {
            "timestamp": "string (MM:SS)",
            "observation": "string"
          }
        ]
      }
    ],
    
    "communication_assessment": {
      "clarity_score": "number (1-10)",
      "articulation": "string",
      "structure": "string",
      "filler_word_frequency": "low" | "moderate" | "high",
      "pace": "too_slow" | "good" | "too_fast",
      "vocabulary_level": "basic" | "professional" | "expert"
    },
    
    "behavioral_assessment": {
      "enabled": "boolean",
      "confidence_indicators": {
        "score": "number (1-10)",
        "observations": ["string"]
      },
      "engagement_indicators": {
        "score": "number (1-10)",
        "observations": ["string"]
      },
      "body_language_notes": ["string"],
      "stress_indicators": ["string"],
      "positive_signals": ["string"]
    },
    
    "summary": {
      "top_strengths": ["string"],
      "areas_of_concern": ["string"],
      "hiring_recommendation": "string",
      "suggested_follow_up_questions": ["string"]
    }
  }
}
```

### Tools
```python
tools = [
    Tool(
        name="analyze_video_segment",
        description="Analyze a specific segment of video for content and behavior",
        parameters={
            "video_url": "str",
            "start_time": "str",
            "end_time": "str",
            "analysis_type": "str"
        }
    ),
    Tool(
        name="transcribe_audio",
        description="Get text transcription of video audio",
        parameters={
            "video_url": "str"
        }
    ),
    Tool(
        name="get_industry_benchmarks",
        description="Get typical response quality benchmarks for role",
        parameters={
            "job_title": "str",
            "experience_level": "str"
        }
    ),
    Tool(
        name="schedule_interview",
        description="Schedule interview in calendar",
        parameters={
            "interviewer_email": "str",
            "candidate_email": "str",
            "duration_minutes": "int",
            "preferred_times": "list[str]"
        }
    )
]
```

### System Prompt (Question Generation)
```
You are the Talent Assessor Agent, an expert interviewer who designs insightful 
assessment questions that reveal candidate capabilities.

YOUR RESPONSIBILITIES:
1. Create questions tailored to the specific role and candidate background
2. Design questions that assess both skills and cultural fit
3. Include a mix of question types for comprehensive evaluation
4. Provide clear rubrics for consistent evaluation

QUESTION DESIGN PRINCIPLES:
- Technical questions should test practical application, not memorization
- Behavioral questions should use STAR format prompts
- Situational questions should reflect realistic scenarios
- Questions should be open-ended to reveal depth of thinking
- Avoid questions that favor specific demographics or backgrounds

DIFFICULTY CALIBRATION:
- Junior: Focus on fundamentals, potential, learning ability
- Mid: Balance of fundamentals and practical application
- Senior: Complex scenarios, leadership, decision-making
- Lead: Strategy, cross-functional thinking, mentorship

OUTPUT FORMAT:
Always respond with valid JSON matching the output schema.
```

### System Prompt (Video Analysis)
```
You are the Talent Assessor Agent analyzing a candidate's video assessment.
You are an expert at evaluating both the content of responses and the way 
they are delivered.

YOUR RESPONSIBILITIES:
1. Evaluate the quality and completeness of each response
2. Assess communication effectiveness
3. Observe behavioral signals (if enabled)
4. Provide an objective, evidence-based recommendation

CONTENT ANALYSIS:
- Did they answer the question asked?
- Did they provide specific examples?
- Did they demonstrate relevant knowledge?
- Did they structure their response clearly?

COMMUNICATION ANALYSIS:
- Clarity and articulation
- Use of professional vocabulary
- Logical flow and structure
- Appropriate pace and energy

BEHAVIORAL ANALYSIS (when enabled):
- Note: This should supplement, not replace, content evaluation
- Look for confidence vs uncertainty signals
- Observe engagement and enthusiasm
- Note any stress indicators
- Document positive professional signals
- Be aware of cultural differences in communication styles
- Do not make judgments based on appearance, accent, or physical characteristics

IMPORTANT GUIDELINES:
- Base all assessments on observable behaviors and stated content
- Provide specific timestamps for notable moments
- Be objective - avoid confirmation bias
- Consider cultural context in communication styles
- Flag concerns, but don't overweight minor issues

OUTPUT FORMAT:
Always respond with valid JSON matching the output schema.
Include specific evidence (quotes, timestamps) for all assessments.
```

---

## Agent 4: Offer Generator Agent

### Purpose
Generate competitive, compliant offer packages including offer letters, calculate compensation within approved bands, and manage the offer delivery process.

### Trigger Conditions
- Candidate approved for offer
- Offer modification requested
- Counter-offer negotiation

### Input Schema
```json
{
  "candidate_id": "uuid",
  "job_id": "uuid",
  "candidate_data": {
    "name": "string",
    "email": "string",
    "current_compensation": {},
    "assessment_score": "number",
    "experience_years": "number"
  },
  "job_data": {
    "title": "string",
    "department": "string",
    "salary_range": {},
    "location": "string"
  },
  "company_policies": {
    "benefits_package": {},
    "equity_guidelines": {},
    "signing_bonus_rules": {}
  },
  "offer_config": {
    "urgency": "normal" | "expedited",
    "negotiation_flexibility": "none" | "limited" | "flexible",
    "start_date_preference": "string"
  }
}
```

### Output Schema
```json
{
  "offer_package": {
    "compensation": {
      "base_salary": "number",
      "currency": "string",
      "pay_frequency": "annual" | "monthly",
      "signing_bonus": "number",
      "annual_bonus_target": "number (percentage)",
      "equity": {
        "type": "options" | "rsu" | "none",
        "amount": "number",
        "vesting_schedule": "string",
        "cliff_months": "number"
      }
    },
    "benefits": [
      {
        "benefit_type": "string",
        "description": "string",
        "value_estimate": "number"
      }
    ],
    "start_date": "string (ISO date)",
    "offer_expiry": "string (ISO date)",
    "contingencies": ["string"]
  },
  "offer_letter": {
    "content": "string (formatted letter)",
    "format": "html" | "pdf"
  },
  "negotiation_guidance": {
    "salary_flexibility": {
      "min": "number",
      "max": "number"
    },
    "other_levers": ["string"],
    "walk_away_point": "string"
  },
  "onboarding_checklist": [
    {
      "task": "string",
      "owner": "hr" | "manager" | "it" | "candidate",
      "due_before_start": "boolean"
    }
  ]
}
```

### Tools
```python
tools = [
    Tool(
        name="calculate_compensation",
        description="Calculate recommended compensation based on inputs",
        parameters={
            "job_level": "str",
            "location": "str",
            "experience_years": "int",
            "assessment_score": "float",
            "market_data": "dict"
        }
    ),
    Tool(
        name="generate_offer_letter",
        description="Generate formatted offer letter document",
        parameters={
            "template_id": "str",
            "offer_details": "dict",
            "format": "str"
        }
    ),
    Tool(
        name="check_comp_approval",
        description="Check if compensation requires additional approval",
        parameters={
            "salary": "float",
            "equity": "float",
            "job_level": "str"
        }
    ),
    Tool(
        name="send_offer_email",
        description="Send offer to candidate via email",
        parameters={
            "candidate_email": "str",
            "offer_letter_url": "str",
            "expiry_date": "str"
        }
    ),
    Tool(
        name="create_onboarding_tasks",
        description="Create tasks in HR system for new hire onboarding",
        parameters={
            "candidate_id": "str",
            "start_date": "str",
            "department": "str"
        }
    )
]
```

### System Prompt
```
You are the Offer Generator Agent, an expert compensation specialist who creates 
competitive, fair offer packages that close top candidates.

YOUR RESPONSIBILITIES:
1. Calculate appropriate compensation within approved bands
2. Generate professional, compelling offer letters
3. Include all required benefits and perks
4. Provide negotiation guidance to hiring managers
5. Ensure compliance with company policies and employment law

COMPENSATION PHILOSOPHY:
- Pay competitively to attract and retain talent
- Be internally equitable (consider existing team compensation)
- Reward exceptional assessment performance
- Account for location-based cost of living
- Balance candidate expectations with budget constraints

OFFER LETTER GUIDELINES:
- Be warm and welcoming in tone
- Clearly state all compensation components
- Include start date and response deadline
- List contingencies (background check, etc.)
- Comply with local employment law requirements

NEGOTIATION GUIDANCE:
- Provide clear boundaries (min/max)
- Suggest non-monetary alternatives if salary is maxed
- Flag when approval is needed for exceptions
- Document all negotiation touchpoints

OUTPUT FORMAT:
Always respond with valid JSON matching the output schema.
Offer letters should be professional and error-free.
```

---

## Inter-Agent Communication

### Handoff Protocol
```python
class AgentHandoff:
    """Standard format for agent-to-agent communication."""
    
    from_agent: str
    to_agent: str
    trigger_event: str
    payload: dict
    priority: str  # normal, high, urgent
    context: dict  # shared context from previous agents
    
# Example: Screener → Assessor handoff
handoff = AgentHandoff(
    from_agent="talent_screener",
    to_agent="talent_assessor",
    trigger_event="shortlist_approved",
    payload={
        "candidates": [...],
        "job_id": "...",
        "screening_context": {...}
    },
    priority="normal",
    context={
        "job_requirements": {...},
        "evaluation_criteria": {...}
    }
)
```

### Shared Context
All agents have access to:
- Job data (requirements, skills matrix, criteria)
- Candidate data (as accumulated through pipeline)
- Company policies (via tool calls)
- Pipeline state (current stage, history)

---

## Error Handling

### Retry Logic
```python
MAX_RETRIES = 3
RETRY_DELAYS = [1, 5, 15]  # seconds

async def run_with_retry(agent, input_data):
    for attempt in range(MAX_RETRIES):
        try:
            return await agent.run(input_data)
        except RateLimitError:
            await asyncio.sleep(RETRY_DELAYS[attempt])
        except ValidationError as e:
            # Don't retry validation errors
            raise
    raise MaxRetriesExceeded()
```

### Fallback Behaviors
- If video analysis fails: Return content-only analysis
- If LinkedIn API fails: Use uploaded CV only
- If calendar API fails: Return available slots to choose manually
- If document generation fails: Return structured data for manual letter

---

## Monitoring & Logging

### Metrics to Track
```python
AGENT_METRICS = {
    "jd_assist": [
        "questions_generated",
        "jd_completeness_score",
        "time_to_generate"
    ],
    "screener": [
        "cvs_processed",
        "avg_match_score",
        "time_per_cv"
    ],
    "assessor": [
        "assessments_analyzed",
        "avg_assessment_score",
        "video_analysis_time"
    ],
    "offer_gen": [
        "offers_generated",
        "acceptance_rate",
        "time_to_accept"
    ]
}
```

### Log Format
```json
{
  "timestamp": "ISO-8601",
  "agent": "string",
  "action": "string",
  "entity_id": "uuid",
  "input_summary": {},
  "output_summary": {},
  "tokens_used": "number",
  "latency_ms": "number",
  "status": "success" | "error",
  "error": "string (if applicable)"
}
```
