# System Design: Autonomous Talent Acquisition Platform

## Executive Summary

A multi-agent AI system that automates the end-to-end talent acquisition workflow, from job description creation to offer generation. Built on Google ADK with Gemini 2.5, featuring real-time video analysis during candidate assessments.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ JD       │ │ Screening│ │ Assessment│ │ Offer    │ │ Dashboard/       │  │
│  │ Builder  │ │ Portal   │ │ Center   │ │ Manager  │ │ Analytics        │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
└───────┼────────────┼────────────┼────────────┼─────────────────┼────────────┘
        │            │            │            │                 │
        ▼            ▼            ▼            ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (FastAPI)                             │
│  /api/v1/jd  │  /api/v1/screen  │  /api/v1/assess  │  /api/v1/offer       │
└───────┬────────────┬────────────┬────────────┬─────────────────┬────────────┘
        │            │            │            │                 │
        ▼            ▼            ▼            ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AGENT ORCHESTRATION LAYER (Google ADK)                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Agent Coordinator / Router                       │   │
│  │    - Routes tasks to appropriate agents                             │   │
│  │    - Manages inter-agent communication                              │   │
│  │    - Handles state transitions                                      │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ JD Assist  │ │ Talent     │ │ Talent     │ │ Offer      │               │
│  │ Agent      │ │ Screener   │ │ Assessor   │ │ Generator  │               │
│  │            │ │ Agent      │ │ Agent      │ │ Agent      │               │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘               │
└────────┼──────────────┼──────────────┼──────────────┼───────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION LAYER                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ LinkedIn │ │ Google   │ │ Email    │ │ Document │ │ Video Processing │  │
│  │ API      │ │ Calendar │ │ (SMTP)   │ │ Gen      │ │ (WebRTC+Gemini)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │              │              │              │              │
         ▼              ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER (Supabase)                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────────┐ │
│  │ PostgreSQL       │ │ Supabase Storage │ │ Supabase Realtime            │ │
│  │ - jobs           │ │ - CVs/Resumes    │ │ - Live notifications         │ │
│  │ - candidates     │ │ - Video recordings│ │ - Agent status updates      │ │
│  │ - assessments    │ │ - Documents      │ │ - Assessment progress        │ │
│  │ - offers         │ │ - Offer letters  │ │                              │ │
│  │ - agent_logs     │ │                  │ │                              │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Workflow & State Machine

```
┌─────────────┐
│   START     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: JD ASSIST AGENT                     │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Input:  │───▶│ Process:    │───▶│ Output:     │             │
│  │ Voice/  │    │ - Extract   │    │ - JD Doc    │             │
│  │ Text    │    │   requirements   │ - Skills    │             │
│  │ Brief   │    │ - Generate JD│    │   Matrix    │             │
│  │         │    │ - Create    │    │ - Eval      │             │
│  │         │    │   criteria  │    │   Criteria  │             │
│  └─────────┘    └─────────────┘    └─────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │ Trigger: JD Approved
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 2: TALENT SCREENER AGENT                  │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Input:  │───▶│ Process:    │───▶│ Output:     │             │
│  │ - JD    │    │ - Parse CVs │    │ - Ranked    │             │
│  │ - CVs   │    │ - Match     │    │   Candidates│             │
│  │ - LinkedIn    │   skills   │    │ - Match     │             │
│  │   profiles│   │ - Score    │    │   Scores    │             │
│  │         │    │   candidates│    │ - Shortlist │             │
│  └─────────┘    └─────────────┘    └─────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │ Trigger: Shortlist Approved
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 3: TALENT ASSESSOR AGENT                  │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Input:  │───▶│ Process:    │───▶│ Output:     │             │
│  │ - JD    │    │ - Generate  │    │ - Assessment│             │
│  │ - Candidate   │   questions │    │   Report    │             │
│  │   profiles│   │ - Schedule  │    │ - Video     │             │
│  │ - Video │    │   interviews│    │   Analysis  │             │
│  │   recordings │ - Analyze   │    │ - Scores    │             │
│  │         │    │   responses │    │ - Recommend │             │
│  └─────────┘    └─────────────┘    └─────────────┘             │
│                                                                 │
│  ⚠️  VIDEO ANALYSIS MODULE (Gemini 3 Vision)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Body language patterns                                  │  │
│  │ - Engagement indicators                                   │  │
│  │ - Response confidence analysis                            │  │
│  │ - Verbal-nonverbal alignment                             │  │
│  │ NOTE: Configurable, can be disabled for compliance       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Trigger: Assessment Complete
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 4: OFFER GENERATOR AGENT                   │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Input:  │───▶│ Process:    │───▶│ Output:     │             │
│  │ - Candidate   │ - Generate  │    │ - Offer     │             │
│  │   profile│    │   offer terms    │   Letter    │             │
│  │ - Comp  │    │ - Create    │    │ - Contract  │             │
│  │   bands │    │   documents │    │ - Onboarding│             │
│  │ - Policy│    │ - Schedule  │    │   Checklist │             │
│  │   rules │    │   onboarding│    │             │             │
│  └─────────┘    └─────────────┘    └─────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │     END      │
                      │ (Candidate   │
                      │  Onboarded)  │
                      └──────────────┘
```

---

## Data Models

### Core Entities

```sql
-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    location VARCHAR(255),
    job_type VARCHAR(50), -- full-time, contract, etc.
    description TEXT,
    requirements JSONB, -- structured requirements
    skills_matrix JSONB, -- required vs nice-to-have skills
    evaluation_criteria JSONB, -- scoring rubric
    salary_range JSONB, -- min, max, currency
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, closed
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates table
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    linkedin_data JSONB, -- cached LinkedIn profile
    resume_url VARCHAR(500), -- Supabase Storage path
    resume_parsed JSONB, -- extracted resume data
    source VARCHAR(50), -- linkedin, referral, direct
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications (Job-Candidate junction)
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id),
    candidate_id UUID REFERENCES candidates(id),
    status VARCHAR(50) DEFAULT 'new', -- new, screening, assessment, offer, hired, rejected
    screening_score DECIMAL(5,2),
    screening_notes JSONB,
    match_details JSONB, -- skill matches, gaps
    current_stage VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, candidate_id)
);

-- Assessments
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),
    assessment_type VARCHAR(50), -- video, technical, personality
    questions JSONB, -- generated questions
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    video_url VARCHAR(500), -- Supabase Storage path
    video_analysis JSONB, -- Gemini 3 analysis results
    response_scores JSONB, -- per-question scores
    overall_score DECIMAL(5,2),
    recommendation VARCHAR(50), -- strong_yes, yes, maybe, no
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id),
    salary DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'USD',
    start_date DATE,
    benefits JSONB,
    offer_letter_url VARCHAR(500),
    contract_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected, negotiating
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Activity Logs
CREATE TABLE agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50) NOT NULL, -- jd_assist, screener, assessor, offer_gen
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- job, candidate, application, etc.
    entity_id UUID,
    input_data JSONB,
    output_data JSONB,
    tokens_used INTEGER,
    latency_ms INTEGER,
    status VARCHAR(50), -- success, error, partial
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### JD Assist Agent
```
POST   /api/v1/jd/create              # Create JD from voice/text input
GET    /api/v1/jd/{id}                # Get JD details
PUT    /api/v1/jd/{id}                # Update JD
POST   /api/v1/jd/{id}/approve        # Approve JD, trigger screening
POST   /api/v1/jd/voice-input         # Stream voice input for JD creation
```

### Talent Screener Agent
```
POST   /api/v1/screen/start           # Start screening for a job
POST   /api/v1/screen/upload-cv       # Upload CV for screening
GET    /api/v1/screen/{job_id}/candidates  # Get screened candidates
POST   /api/v1/screen/linkedin-search # Search LinkedIn for candidates
PUT    /api/v1/screen/shortlist       # Approve/modify shortlist
```

### Talent Assessor Agent
```
POST   /api/v1/assess/generate-questions  # Generate assessment questions
POST   /api/v1/assess/schedule        # Schedule assessment
POST   /api/v1/assess/start-video     # Start video assessment session
POST   /api/v1/assess/submit-video    # Submit recorded video
GET    /api/v1/assess/{id}/analysis   # Get video analysis results
POST   /api/v1/assess/{id}/approve    # Approve candidate for offer
```

### Offer Generator Agent
```
POST   /api/v1/offer/generate         # Generate offer package
GET    /api/v1/offer/{id}             # Get offer details
PUT    /api/v1/offer/{id}             # Modify offer
POST   /api/v1/offer/{id}/send        # Send offer to candidate
PUT    /api/v1/offer/{id}/status      # Update offer status
```

### Dashboard & Analytics
```
GET    /api/v1/dashboard/metrics      # Overall metrics
GET    /api/v1/dashboard/pipeline     # Pipeline status
GET    /api/v1/dashboard/agent-logs   # Agent activity
```

---

## Security Considerations

### Authentication & Authorization
- Supabase Auth for user authentication
- Row Level Security (RLS) on all tables
- Role-based access: Admin, Hiring Manager, Recruiter, Interviewer

### Data Privacy
- Video recordings encrypted at rest
- PII fields encrypted in database
- Configurable data retention policies
- GDPR compliance: right to deletion, data export

### Video Analysis Consent
- Explicit consent capture before video recording
- Clear disclosure of AI analysis
- Option to opt-out of behavioral analysis
- Audit trail of consent

---

## Scaling Considerations

### Horizontal Scaling
- Stateless FastAPI instances behind load balancer
- Agent workers as separate processes (can scale independently)
- Video processing as background jobs (Celery/RQ)

### Performance Optimizations
- Redis caching for frequent queries
- Connection pooling for database
- Streaming video upload (chunked)
- Gemini API batching for bulk processing

---

## Monitoring & Observability

### Metrics to Track
- Agent response times
- API latency (p50, p95, p99)
- Gemini API usage and costs
- Video processing queue depth
- Error rates by agent type

### Logging
- Structured JSON logs
- Correlation IDs across services
- Agent decision logging for explainability

### Alerts
- API error rate > 5%
- Agent task failure
- Video processing backlog > 100
- Gemini API quota warnings
