# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TalentAI - A multi-agent AI system that automates talent acquisition from job description creation to offer generation. Uses Google ADK with Gemini 3, Supabase, Next.js 14, and FastAPI.

## Commands

### Using Makefiles
```bash
make install      # install all dependencies (backend + frontend)
make dev          # run both backend and frontend dev servers
make test         # run all tests
make lint         # run linters
make format       # format code
make db-push      # push database migrations
make db-types     # generate TypeScript types from schema
```

### Backend (uv)
```bash
cd backend
uv sync                                   # install dependencies
uv run uvicorn app.main:app --reload --port 8000

uv run pytest                             # all tests
uv run pytest tests/test_file.py -k "test_name"  # single test
uv run black . && uv run ruff check .     # format and lint
```

### Frontend
```bash
cd frontend
npm install
npm run dev                    # dev server on :3000
npm test                       # tests
npm run lint && npm run format # lint and format
```

### Database
```bash
supabase start
supabase db push
supabase gen types typescript --local > types/supabase.ts
```

## Architecture

### Four Agents (Sequential Pipeline)
1. **JD Assist** - Voice/text → structured job description with skills matrix
2. **Talent Screener** - CVs → scored/ranked candidates
3. **Talent Assessor** - Generates questions, analyzes video responses via Gemini Vision
4. **Offer Generator** - Creates compensation packages and offer letters

Flow: `JD Created → Approved → Screening → Shortlist Approved → Assessment → Complete → Offer`

### Google ADK Agent Pattern
Agents use Google ADK's native `LlmAgent` with `SequentialAgent` for pipeline orchestration:

```python
from google.adk.agents import LlmAgent, SequentialAgent

jd_assist = LlmAgent(
    name="jd_assist",
    model="gemini-2.5-flash",  # or gemini-2.5-pro-preview-03-25
    description="Creates job descriptions from input",
    instruction="Create structured JD with skills matrix.",
    tools=[search_similar_jds],  # Plain functions auto-convert to tools
    output_key="jd_data"  # Stores result in session state for next agent
)

# Sequential pipeline passes state between agents via output_key
hiring_pipeline = SequentialAgent(
    name="hiring_pipeline",
    sub_agents=[jd_assist, talent_screener, talent_assessor, offer_generator]
)
```

Use `ParallelAgent` for concurrent CV screening. State sharing via `{output_key}` template syntax in instructions.

### Key Integration Points
- Agent prompts are in `files/AGENT_SPECS.md` - use exactly as specified
- Video analysis uses Gemini Vision for response quality, communication, and behavioral indicators
- Supabase handles auth, storage (resumes/videos/documents), and real-time agent status updates
- ADK FastAPI integration: use `get_fast_api_app()` from `google.adk.cli.fast_api` or manual endpoint integration
- Environment: `GOOGLE_API_KEY` + `GOOGLE_GENAI_USE_VERTEXAI=FALSE` for dev, Vertex AI for production

## Project Structure

```
frontend/app/(dashboard)/     # Jobs, candidates, assessments, offers screens
frontend/app/assess/[token]/  # Candidate-facing video assessment
frontend/components/          # UI grouped by feature (jd/, screening/, assessment/, offer/)

backend/app/agents/           # Agent implementations + tools/
backend/app/api/v1/           # FastAPI endpoints
backend/app/services/         # Supabase, Gemini, email integrations
```

## Reference Documents
- `files/AGENT_SPECS.md` - Agent prompts, I/O schemas, tools
- `files/SYSTEM_DESIGN.md` - Architecture, data models, APIs
- `files/TECH_STACK.md` - Dependencies and code patterns
- `files/UX_SPEC.md` - Screen layouts and design system
- `files/001_initial_schema.sql` - Database schema
