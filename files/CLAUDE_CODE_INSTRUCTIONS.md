# Claude Code Instructions

## Project Context

You are building **Telentic**, an Autonomous Talent Acquisition Platform - a multi-agent AI system that automates the end-to-end hiring workflow using Google ADK and Gemini 3.

### Tech Stack
- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui)
- **Backend**: Python FastAPI
- **AI Framework**: Google ADK with Gemini 3 (gemini-3.0-pro)
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Video**: WebRTC recording + Gemini Vision analysis

### The Four Agents
1. **JD Assist Agent** - Creates job descriptions from voice/text input
2. **Talent Screener Agent** - Scores and ranks candidates against job requirements
3. **Talent Assessor Agent** - Generates questions, analyzes video assessments
4. **Offer Generator Agent** - Creates compensation packages and offer letters

---

## Project Structure

```
telentic/
├── frontend/                    # Next.js 14 application
│   ├── app/
│   │   ├── (auth)/             # Login, signup
│   │   ├── (dashboard)/        # Main app screens
│   │   │   ├── jobs/
│   │   │   ├── candidates/
│   │   │   ├── assessments/
│   │   │   └── offers/
│   │   └── assess/[token]/     # Candidate assessment page
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── agents/             # Agent status, logs
│   │   ├── jd/                 # JD builder components
│   │   ├── screening/          # Screening components
│   │   ├── assessment/         # Video recorder, analysis
│   │   └── offer/              # Offer builder
│   ├── lib/
│   │   ├── supabase/
│   │   └── api/
│   └── hooks/
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/v1/             # API endpoints
│   │   ├── agents/             # Agent implementations
│   │   │   ├── base.py
│   │   │   ├── coordinator.py
│   │   │   ├── jd_assist.py
│   │   │   ├── talent_screener.py
│   │   │   ├── talent_assessor.py
│   │   │   ├── offer_generator.py
│   │   │   └── tools/          # Agent tools
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   └── tests/
│
├── docs/                        # Documentation
│   ├── SYSTEM_DESIGN.md
│   ├── TECH_STACK.md
│   ├── UX_SPEC.md
│   ├── AGENT_SPECS.md
│   └── CLAUDE_CODE_INSTRUCTIONS.md
│
└── supabase/                    # Database migrations
    └── migrations/
```

---

## Build Order (Recommended)

### Phase 1: Foundation
1. Set up Supabase project and database schema
2. Create FastAPI boilerplate with health check
3. Set up Next.js with Supabase auth
4. Create basic dashboard layout

### Phase 2: JD Assist Agent
1. Implement JD Assist agent with Gemini
2. Build JD Builder UI (voice input, text input, file upload)
3. Create JD review/edit screen
4. Connect frontend to backend

### Phase 3: Talent Screener Agent
1. Implement CV parsing tool
2. Build Screener agent
3. Create CV upload UI
4. Build candidate list with scoring

### Phase 4: Talent Assessor Agent
1. Implement question generation
2. Build video recorder component
3. Implement video analysis with Gemini Vision
4. Create assessment results UI

### Phase 5: Offer Generator Agent
1. Implement offer calculation logic
2. Build offer letter generation
3. Create offer builder UI
4. Add email sending

### Phase 6: Integration & Polish
1. Connect all agent handoffs
2. Add real-time updates
3. Polish UI/UX
4. Error handling and edge cases

---

## Key Implementation Details

### Google ADK Agent Pattern
```python
# backend/app/agents/agents.py
from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent
from google.adk.runners import InMemoryRunner
from google.adk.sessions import InMemorySessionService

# Model: gemini-2.5-flash (fast) or gemini-2.5-pro-preview-03-25 (powerful)
GEMINI_MODEL = "gemini-2.5-flash"

# Define tools as plain functions - ADK auto-converts them
def search_similar_jds(keywords: list[str], department: str) -> dict:
    """Search internal database for similar job descriptions."""
    return {"status": "success", "results": []}

# Create agent with tools
jd_assist = LlmAgent(
    name="jd_assist",
    model=GEMINI_MODEL,
    description="Creates job descriptions from voice/text input",
    instruction="You are the JD Assist Agent. Create structured JDs.",
    tools=[search_similar_jds],
    output_key="jd_data"  # Stores result in session state
)

# Sequential pipeline - agents pass state via output_key
hiring_pipeline = SequentialAgent(
    name="hiring_pipeline",
    sub_agents=[jd_assist, talent_screener, talent_assessor, offer_generator]
)

# Run agent programmatically
async def run_agent(agent, user_input: str):
    session_service = InMemorySessionService()
    runner = InMemoryRunner(agent=agent, session_service=session_service)
    session = await session_service.create_session(app_name=agent.name, user_id="user")

    async for event in runner.run_async(session_id=session.id, user_id="user", new_message=user_input):
        if event.content:
            return event.content
```

### Supabase Client Setup
```typescript
// frontend/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### FastAPI + Supabase
```python
# backend/app/services/supabase.py
from supabase import create_client, Client
from app.config import settings

def get_supabase() -> Client:
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY
    )
```

### Video Recording (Frontend)
```typescript
// frontend/components/assessment/VideoRecorder.tsx
import RecordRTC from 'recordrtc';

export function useVideoRecorder() {
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true
    });
    
    const recorder = new RecordRTC(stream, {
      type: 'video',
      mimeType: 'video/webm;codecs=vp9',
    });
    
    recorder.startRecording();
    return { recorder, stream };
  };
  
  const stopRecording = (recorder: RecordRTC): Promise<Blob> => {
    return new Promise((resolve) => {
      recorder.stopRecording(() => resolve(recorder.getBlob()));
    });
  };
  
  return { startRecording, stopRecording };
}
```

### Video Analysis (Backend with ADK)
```python
# backend/app/agents/tools/video.py
from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.adk.sessions import InMemorySessionService

# Video analysis uses Gemini's multimodal capabilities
video_analyzer = LlmAgent(
    name="video_analyzer",
    model="gemini-2.5-flash",
    description="Analyzes candidate video assessments",
    instruction="""Analyze this candidate assessment video.
    Evaluate: response quality, communication clarity, engagement.
    Return structured JSON with scores and observations.""",
    output_key="video_analysis"
)

async def analyze_video(video_url: str, questions: list) -> dict:
    """Analyze video using ADK agent with multimodal input."""
    session_service = InMemorySessionService()
    runner = InMemoryRunner(agent=video_analyzer, session_service=session_service)
    session = await session_service.create_session(app_name="video_analyzer", user_id="system")

    # Pass video URL and questions as context
    prompt = f"Analyze video at {video_url}. Questions asked: {questions}"

    async for event in runner.run_async(session_id=session.id, user_id="system", new_message=prompt):
        if event.content:
            return event.content
```

---

## Environment Variables

### Backend (.env)
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Google ADK - Development (Google AI Studio)
GOOGLE_API_KEY=AIza...
GOOGLE_GENAI_USE_VERTEXAI=FALSE

# Google ADK - Production (Vertex AI)
# GOOGLE_GENAI_USE_VERTEXAI=TRUE
# GOOGLE_CLOUD_PROJECT=your_project_id
# GOOGLE_CLOUD_LOCATION=us-central1

# LinkedIn (optional for POC)
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Database Schema (Quick Reference)

```sql
-- Core tables
jobs (id, title, department, location, description, skills_matrix, status, ...)
candidates (id, email, first_name, last_name, resume_url, linkedin_url, ...)
applications (id, job_id, candidate_id, status, screening_score, ...)
assessments (id, application_id, questions, video_url, video_analysis, ...)
offers (id, application_id, salary, benefits, offer_letter_url, status, ...)
agent_logs (id, agent_type, action, entity_id, input_data, output_data, ...)
```

---

## API Endpoints Summary

```
# JD Assist
POST   /api/v1/jd/create
GET    /api/v1/jd/{id}
PUT    /api/v1/jd/{id}
POST   /api/v1/jd/{id}/approve

# Screening
POST   /api/v1/screen/start
POST   /api/v1/screen/upload-cv
GET    /api/v1/screen/{job_id}/candidates
PUT    /api/v1/screen/shortlist

# Assessment
POST   /api/v1/assess/generate-questions
POST   /api/v1/assess/schedule
POST   /api/v1/assess/submit-video
GET    /api/v1/assess/{id}/analysis

# Offers
POST   /api/v1/offer/generate
GET    /api/v1/offer/{id}
POST   /api/v1/offer/{id}/send
```

---

## Common Commands

### Using Makefile (Recommended)
```bash
make install      # Install all dependencies
make dev          # Run both backend and frontend
make test         # Run all tests
make lint         # Run linters
make format       # Format code
make db-push      # Push database migrations
make db-types     # Generate TypeScript types
```

### Manual Commands
```bash
# Backend (using uv)
cd backend
uv sync                                    # Install dependencies
uv run uvicorn app.main:app --reload       # Run server
uv run pytest                              # Run tests
uv run black . && uv run ruff check .      # Format and lint

# Frontend
cd frontend
npm install
npm run dev

# Database (Supabase CLI)
supabase start
supabase db push
supabase gen types typescript --local > types/supabase.ts
```

---

## Testing Checklist

### JD Assist Agent
- [ ] Voice input transcribes correctly
- [ ] Text input generates complete JD
- [ ] Skills matrix is properly weighted
- [ ] Evaluation criteria are measurable

### Talent Screener Agent
- [ ] PDF/DOCX parsing works
- [ ] Scoring matches requirements
- [ ] Rankings are sensible
- [ ] Match explanations are clear

### Talent Assessor Agent
- [ ] Questions are role-appropriate
- [ ] Video recording works (WebRTC)
- [ ] Video uploads to storage
- [ ] Gemini analysis returns structured data
- [ ] Behavioral analysis (when enabled) is objective

### Offer Generator Agent
- [ ] Salary within approved band
- [ ] Benefits correctly included
- [ ] Offer letter generates as PDF
- [ ] Email delivery works

---

## Notes for Development

1. **Start with mock data** - Create seed data for testing before building real integrations

2. **Agent prompts are critical** - The system prompts in AGENT_SPECS.md are carefully crafted. Use them exactly.

3. **Video analysis is the "wow" feature** - Make sure this works smoothly in the demo

4. **Real integrations can be stubbed** - LinkedIn, Calendar can return mock data for POC

5. **Error handling matters** - Users will hit edge cases. Handle gracefully.

6. **Keep the UI simple** - Focus on the agent workflow, not fancy UI features

---

## Quick Wins for Demo

1. **Pre-record a voice JD input** - Don't rely on live mic in demo
2. **Have sample CVs ready** - Good and bad matches
3. **Pre-record assessment video** - Show analysis without waiting
4. **Use realistic job data** - "Senior Software Engineer" not "Test Job"

---

## Reference Documents

Refer to these docs for detailed specifications:
- `SYSTEM_DESIGN.md` - Architecture, data models, API design
- `TECH_STACK.md` - Dependencies, setup, code patterns
- `UX_SPEC.md` - Screen layouts, user flows, design system
- `AGENT_SPECS.md` - Agent prompts, inputs/outputs, tools
