# Tech Stack Specification

## Overview

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Frontend | Next.js | 14.x | App Router, RSC, excellent DX |
| Backend | FastAPI | 0.109.x | Async, type-safe, fast |
| AI Framework | Google ADK | 1.x | Native Gemini integration, agent orchestration |
| LLM | Gemini 2.5 | gemini-2.5-flash / gemini-2.5-pro-preview-03-25 | Multimodal (video), fast inference |
| Database | Supabase (PostgreSQL) | Latest | Auth, Realtime, Storage included |
| Video | WebRTC + Gemini Vision | - | Browser recording + AI analysis |
| Deployment | Docker + Cloud Run | - | Scalable, managed |

---

## Frontend: Next.js 14

### Why Next.js
- App Router for file-based routing with layouts
- Server Components reduce client bundle
- Built-in API routes (though we'll use FastAPI)
- Excellent TypeScript support
- Vercel deployment simplicity

### Key Dependencies
```json
{
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/auth-helpers-nextjs": "^0.9.0",
    "tailwindcss": "^3.4.0",
    "shadcn/ui": "latest",
    "zustand": "^4.5.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "axios": "^1.6.0",
    "date-fns": "^3.0.0",
    "recharts": "^2.10.0",
    "react-dropzone": "^14.2.0",
    "recordrtc": "^5.6.2"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.10.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0"
  }
}
```

### Project Structure
```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── jobs/
│   │   │   ├── page.tsx                # Jobs list
│   │   │   ├── new/page.tsx            # JD Builder
│   │   │   └── [id]/page.tsx           # Job detail
│   │   ├── candidates/
│   │   │   ├── page.tsx                # All candidates
│   │   │   └── [id]/page.tsx           # Candidate profile
│   │   ├── assessments/
│   │   │   ├── page.tsx                # Assessment queue
│   │   │   └── [id]/page.tsx           # Assessment detail
│   │   └── offers/
│   │       ├── page.tsx                # Offers list
│   │       └── [id]/page.tsx           # Offer detail
│   ├── assess/                         # Candidate-facing assessment
│   │   └── [token]/page.tsx
│   └── layout.tsx
├── components/
│   ├── ui/                             # shadcn components
│   ├── agents/
│   │   ├── AgentStatusCard.tsx
│   │   ├── AgentActivityLog.tsx
│   │   └── AgentProgressIndicator.tsx
│   ├── jd/
│   │   ├── JDBuilder.tsx
│   │   ├── VoiceInput.tsx
│   │   └── SkillsMatrix.tsx
│   ├── screening/
│   │   ├── CandidateCard.tsx
│   │   ├── CVUploader.tsx
│   │   └── MatchScoreDisplay.tsx
│   ├── assessment/
│   │   ├── VideoRecorder.tsx
│   │   ├── QuestionDisplay.tsx
│   │   └── VideoAnalysisReport.tsx
│   └── offer/
│       ├── OfferBuilder.tsx
│       └── OfferPreview.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── api/
│   │   └── client.ts                   # FastAPI client
│   └── utils/
├── hooks/
│   ├── useAgent.ts
│   ├── useVideoRecorder.ts
│   └── useRealtime.ts
├── stores/
│   ├── jobStore.ts
│   └── assessmentStore.ts
└── types/
    └── index.ts
```

---

## Backend: FastAPI + Google ADK

### Why FastAPI
- Async-native (critical for AI workloads)
- Automatic OpenAPI documentation
- Pydantic for type validation
- Easy dependency injection
- Native WebSocket support

### Why Google ADK
- First-party Gemini integration
- Built-in agent orchestration primitives
- Tool calling support
- Streaming responses
- Production-ready patterns

### Key Dependencies
```toml
# pyproject.toml (managed by uv)
[project]
name = "telentic-backend"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "python-multipart>=0.0.6",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",

    # Google ADK (includes Gemini support)
    "google-adk>=1.0.0",

    # Database
    "supabase>=2.3.0",
    "asyncpg>=0.29.0",

    # Utilities
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "httpx>=0.26.0",
    "aiofiles>=23.2.0",
    "python-dateutil>=2.8.2",

    # Document processing
    "pypdf>=3.17.0",
    "python-docx>=1.1.0",
    "mammoth>=1.6.0",

    # Background tasks
    "celery[redis]>=5.3.0",
    "redis>=5.0.0",
]

[dependency-groups]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "black>=24.1.0",
    "ruff>=0.1.0",
    "mypy>=1.8.0",
]
```

### Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                         # FastAPI app entry
│   ├── config.py                       # Settings
│   ├── dependencies.py                 # DI providers
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py               # Main router
│   │   │   ├── jd.py                   # JD endpoints
│   │   │   ├── screening.py            # Screening endpoints
│   │   │   ├── assessment.py           # Assessment endpoints
│   │   │   ├── offer.py                # Offer endpoints
│   │   │   └── dashboard.py            # Analytics endpoints
│   │   └── deps.py                     # Route dependencies
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py                     # Base agent class
│   │   ├── coordinator.py              # Agent orchestration
│   │   ├── jd_assist.py                # JD Assist Agent
│   │   ├── talent_screener.py          # Screening Agent
│   │   ├── talent_assessor.py          # Assessment Agent
│   │   ├── offer_generator.py          # Offer Agent
│   │   └── tools/
│   │       ├── __init__.py
│   │       ├── linkedin.py             # LinkedIn API tools
│   │       ├── calendar.py             # Calendar tools
│   │       ├── email.py                # Email tools
│   │       ├── document.py             # Doc generation
│   │       └── video.py                # Video analysis
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── job.py
│   │   ├── candidate.py
│   │   ├── application.py
│   │   ├── assessment.py
│   │   └── offer.py
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── job.py
│   │   ├── candidate.py
│   │   ├── assessment.py
│   │   └── offer.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── supabase.py                 # Supabase client
│   │   ├── gemini.py                   # Gemini client
│   │   ├── linkedin.py                 # LinkedIn integration
│   │   ├── calendar.py                 # Google Calendar
│   │   ├── email.py                    # Email service
│   │   └── storage.py                  # File storage
│   │
│   └── workers/
│       ├── __init__.py
│       ├── celery_app.py
│       └── tasks/
│           ├── video_processing.py
│           ├── cv_parsing.py
│           └── notifications.py
│
├── tests/
├── scripts/
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

---

## Google ADK Agent Pattern

### Installation
```bash
uv add google-adk
```

### Base Agent Structure (ADK Native Pattern)
```python
# app/agents/base.py
from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.adk.sessions import InMemorySessionService
from typing import Any
import logging

# Model options: gemini-2.5-flash (fast), gemini-2.5-pro-preview-03-25 (powerful)
GEMINI_MODEL = "gemini-2.5-flash"

def create_tool(func):
    """Decorator pattern - ADK auto-converts functions to tools."""
    return func

# Example agent with tools
@create_tool
def search_similar_jds(keywords: list[str], department: str, limit: int = 5) -> dict:
    """Search internal database for similar job descriptions."""
    # Implementation
    return {"status": "success", "results": []}

jd_assist_agent = LlmAgent(
    name="jd_assist",
    model=GEMINI_MODEL,
    description="Creates job descriptions from voice/text input",
    instruction="""You are the JD Assist Agent, an expert HR consultant.
    Transform voice or text input into structured job descriptions with
    skills matrices and evaluation criteria.""",
    tools=[search_similar_jds],
    output_key="jd_result"  # Stores result in session state
)
```

### Sequential Workflow with Agent Handoff
```python
# app/agents/coordinator.py
from google.adk.agents import SequentialAgent, LlmAgent

# Define specialized agents
jd_assist = LlmAgent(
    name="jd_assist",
    model="gemini-2.5-flash",
    description="Creates job descriptions from input",
    instruction="Create structured JD with skills matrix.",
    output_key="jd_data"
)

talent_screener = LlmAgent(
    name="talent_screener",
    model="gemini-2.5-flash",
    description="Scores candidates against job requirements",
    instruction="Analyze CVs against {jd_data} requirements.",
    output_key="screening_results"
)

talent_assessor = LlmAgent(
    name="talent_assessor",
    model="gemini-2.5-flash",
    description="Generates questions and analyzes assessments",
    instruction="Generate questions based on {jd_data}. Analyze responses.",
    output_key="assessment_results"
)

offer_generator = LlmAgent(
    name="offer_generator",
    model="gemini-2.5-flash",
    description="Creates compensation packages and offer letters",
    instruction="Generate offer based on {assessment_results}.",
    output_key="offer_data"
)

# Sequential pipeline - agents pass state via output_key
hiring_pipeline = SequentialAgent(
    name="hiring_pipeline",
    sub_agents=[jd_assist, talent_screener, talent_assessor, offer_generator]
)
```

### Parallel Agent Execution (for CV screening)
```python
from google.adk.agents import ParallelAgent, SequentialAgent, LlmAgent

# Screen multiple CVs in parallel
cv_screener_1 = LlmAgent(
    name="cv_screener_1",
    model="gemini-2.5-flash",
    instruction="Screen CV against job requirements.",
    output_key="cv1_score"
)

cv_screener_2 = LlmAgent(
    name="cv_screener_2",
    model="gemini-2.5-flash",
    instruction="Screen CV against job requirements.",
    output_key="cv2_score"
)

# Run screenings in parallel
parallel_screening = ParallelAgent(
    name="parallel_cv_screening",
    sub_agents=[cv_screener_1, cv_screener_2]
)

# Then merge results
results_merger = LlmAgent(
    name="results_merger",
    model="gemini-2.5-flash",
    instruction="Rank candidates from {cv1_score} and {cv2_score}.",
    output_key="ranked_candidates"
)

screening_workflow = SequentialAgent(
    name="screening_workflow",
    sub_agents=[parallel_screening, results_merger]
)
```

### Running Agents Programmatically
```python
from google.adk.runners import InMemoryRunner
from google.adk.sessions import InMemorySessionService
import asyncio

async def run_agent(agent, user_input: str):
    """Execute an agent with input and return result."""
    session_service = InMemorySessionService()
    runner = InMemoryRunner(agent=agent, session_service=session_service)

    session = await session_service.create_session(
        app_name=agent.name,
        user_id="user_123"
    )

    result = None
    async for event in runner.run_async(
        session_id=session.id,
        user_id="user_123",
        new_message=user_input
    ):
        if event.content:
            result = event.content

    return result

# Usage
result = asyncio.run(run_agent(jd_assist, "Create a Senior Engineer JD"))
```

### FastAPI Integration
```python
# app/main.py
from fastapi import FastAPI
from google.adk.cli.fast_api import get_fast_api_app
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown

# Option 1: Use ADK's built-in FastAPI wrapper
app = get_fast_api_app(
    agents_dir="app/agents",
    web=False,
    lifespan=lifespan
)

# Add custom routes
from app.api.v1 import router as api_router
app.include_router(api_router, prefix="/api/v1")

# Option 2: Manual integration with custom endpoints
from fastapi import FastAPI
from app.agents.coordinator import hiring_pipeline, run_agent

app = FastAPI()

@app.post("/api/v1/jd/create")
async def create_jd(input_text: str):
    result = await run_agent(jd_assist, input_text)
    return {"jd": result}
```

### Environment Configuration
```bash
# .env - Google AI Studio (recommended for development)
GOOGLE_API_KEY=your_api_key
GOOGLE_GENAI_USE_VERTEXAI=FALSE

# .env - Vertex AI (recommended for production)
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
```

---

## Database: Supabase Setup

### Environment Variables
```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Google
GOOGLE_API_KEY=your-gemini-api-key
GOOGLE_PROJECT_ID=your-gcp-project

# LinkedIn
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password
```

### Row Level Security Policies
```sql
-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Jobs: Org members can view, managers can edit
CREATE POLICY "Users can view org jobs" ON jobs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM org_members 
            WHERE org_id = jobs.org_id
        )
    );

CREATE POLICY "Managers can edit jobs" ON jobs
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM org_members 
            WHERE org_id = jobs.org_id 
            AND role IN ('admin', 'hiring_manager')
        )
    );
```

---

## Video Recording & Analysis

### Frontend: WebRTC Recording
```typescript
// components/assessment/VideoRecorder.tsx
import RecordRTC from 'recordrtc';

export function useVideoRecorder() {
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const startRecording = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: true
    });
    
    const rtcRecorder = new RecordRTC(mediaStream, {
      type: 'video',
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    });
    
    rtcRecorder.startRecording();
    setStream(mediaStream);
    setRecorder(rtcRecorder);
  };
  
  const stopRecording = async (): Promise<Blob> => {
    return new Promise((resolve) => {
      recorder?.stopRecording(() => {
        const blob = recorder.getBlob();
        stream?.getTracks().forEach(track => track.stop());
        resolve(blob);
      });
    });
  };
  
  return { startRecording, stopRecording };
}
```

### Backend: Gemini Video Analysis
```python
# app/agents/tools/video.py
from google import genai
import base64

class VideoAnalyzer:
    """Analyze assessment videos using Gemini 3 Vision."""
    
    def __init__(self):
        self.client = genai.Client()
    
    async def analyze_assessment_video(
        self, 
        video_url: str,
        questions: list[dict],
        job_requirements: dict
    ) -> dict:
        """
        Analyze candidate video assessment.
        
        Returns structured analysis including:
        - Response quality per question
        - Communication patterns
        - Engagement indicators
        - Body language observations (configurable)
        """
        
        video_data = await self._fetch_video(video_url)
        
        prompt = f"""
        Analyze this candidate assessment video for the following role:
        
        Job Requirements:
        {job_requirements}
        
        Assessment Questions:
        {questions}
        
        Provide analysis in the following structure:
        
        1. RESPONSE ANALYSIS (per question):
           - Relevance to question (1-10)
           - Depth of answer (1-10)
           - Examples provided (yes/no, quality)
           - Key points mentioned
        
        2. COMMUNICATION ASSESSMENT:
           - Clarity of speech (1-10)
           - Articulation quality
           - Filler word frequency
           - Pace and rhythm
        
        3. ENGAGEMENT INDICATORS:
           - Eye contact consistency
           - Energy level
           - Enthusiasm signals
           - Confidence markers
        
        4. BEHAVIORAL OBSERVATIONS:
           - Body language patterns
           - Nervous indicators
           - Positive signals
           - Areas of discomfort
        
        5. OVERALL RECOMMENDATION:
           - Strengths
           - Areas of concern
           - Fit score (1-100)
           - Recommendation: STRONG_YES / YES / MAYBE / NO
        
        Be objective and base analysis only on observable behaviors.
        """
        
        response = await self.client.aio.models.generate_content(
            model="gemini-3.0-pro",
            contents=[
                {"role": "user", "parts": [
                    {"video": video_data},
                    {"text": prompt}
                ]}
            ],
            config={
                "temperature": 0.3,  # Lower for more consistent analysis
            }
        )
        
        return self._parse_analysis(response.text)
    
    async def _fetch_video(self, url: str) -> bytes:
        """Fetch video from Supabase storage."""
        # Implementation
        pass
    
    def _parse_analysis(self, text: str) -> dict:
        """Parse Gemini response into structured format."""
        # Implementation
        pass
```

---

## Real Integrations

### LinkedIn API
```python
# app/services/linkedin.py
import httpx
from typing import Optional

class LinkedInService:
    """LinkedIn API integration for candidate sourcing."""
    
    BASE_URL = "https://api.linkedin.com/v2"
    
    def __init__(self, access_token: str):
        self.token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    async def search_candidates(
        self,
        keywords: list[str],
        location: Optional[str] = None,
        current_company: Optional[str] = None,
        limit: int = 25
    ) -> list[dict]:
        """Search for candidates matching criteria."""
        async with httpx.AsyncClient() as client:
            # Note: LinkedIn Recruiter API required for full search
            # This is simplified for POC
            params = {
                "keywords": " ".join(keywords),
                "count": limit,
            }
            if location:
                params["location"] = location
                
            response = await client.get(
                f"{self.BASE_URL}/people-search",
                headers=self.headers,
                params=params
            )
            return response.json().get("elements", [])
    
    async def get_profile(self, profile_id: str) -> dict:
        """Get detailed profile information."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/people/{profile_id}",
                headers=self.headers,
                params={
                    "projection": "(id,firstName,lastName,headline,profilePicture,positions)"
                }
            )
            return response.json()
```

### Google Calendar
```python
# app/services/calendar.py
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta

class CalendarService:
    """Google Calendar integration for scheduling."""
    
    def __init__(self, credentials: Credentials):
        self.service = build('calendar', 'v3', credentials=credentials)
    
    async def find_available_slots(
        self,
        interviewer_email: str,
        duration_minutes: int = 60,
        days_ahead: int = 14
    ) -> list[dict]:
        """Find available time slots for interviews."""
        now = datetime.utcnow()
        end = now + timedelta(days=days_ahead)
        
        # Get busy times
        freebusy = self.service.freebusy().query(body={
            "timeMin": now.isoformat() + "Z",
            "timeMax": end.isoformat() + "Z",
            "items": [{"id": interviewer_email}]
        }).execute()
        
        busy_times = freebusy["calendars"][interviewer_email]["busy"]
        
        # Calculate available slots (9 AM - 5 PM, weekdays)
        available = self._calculate_available_slots(
            now, end, busy_times, duration_minutes
        )
        
        return available
    
    async def create_interview_event(
        self,
        interviewer_email: str,
        candidate_email: str,
        start_time: datetime,
        duration_minutes: int,
        job_title: str
    ) -> dict:
        """Create calendar event for interview."""
        event = {
            "summary": f"Interview: {job_title}",
            "description": "Video assessment interview",
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "UTC"
            },
            "end": {
                "dateTime": (start_time + timedelta(minutes=duration_minutes)).isoformat(),
                "timeZone": "UTC"
            },
            "attendees": [
                {"email": interviewer_email},
                {"email": candidate_email}
            ],
            "conferenceData": {
                "createRequest": {"requestId": f"interview-{start_time.timestamp()}"}
            }
        }
        
        return self.service.events().insert(
            calendarId="primary",
            body=event,
            conferenceDataVersion=1
        ).execute()
```

---

## Development Setup

### Quick Start with Makefile (Recommended)
```bash
# Clone and setup
git clone <repo>
cd telentic

# Install all dependencies
make install

# Copy and configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit both files with your keys

# Run both servers
make dev
```

### Manual Setup
```bash
# Backend
cd backend
uv sync  # Install dependencies
cp .env.example .env
# Edit .env with your keys

# Run backend
uv run uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local

# Run frontend
npm run dev
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --reload

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_API_URL=http://backend:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  celery:
    build: ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
      - backend
```

---

## API Keys Required

| Service | Required | How to Get |
|---------|----------|------------|
| Google Gemini | Yes | Google AI Studio → API Key |
| Supabase | Yes | Supabase Dashboard → Settings → API |
| LinkedIn | For full features | LinkedIn Developer Portal → Create App |
| Google Calendar | For scheduling | GCP Console → Enable Calendar API |
| SMTP | For emails | Gmail App Password or Resend |
