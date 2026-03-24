# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telentic - A multi-agent AI system that automates talent acquisition from job description creation to offer generation. Uses Google ADK with Gemini 3, Supabase, Next.js 14, and FastAPI.

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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Talentic — Autonomous Talent Acquisition Platform**

Talentic is an AI-powered autonomous recruitment platform that automates the entire hiring pipeline — from candidate sourcing to offer generation — using multi-agent AI (Google ADK + Gemini). It replaces the fragmented recruiter workflow (LinkedIn Recruiter + email tools + ATS + spreadsheets) with a single platform where AI agents source, screen, assess, phone-screen, and generate offers while the recruiter stays in control. Built for startups, talent acquisition teams, and recruiting agencies.

**Core Value:** The platform must make a recruiter feel like they have an **autonomous hiring team** working 24/7 — sourcing candidates, screening resumes, conducting phone screens, analyzing video assessments, and preparing offers — while they only step in for human-judgment moments (interviews, final decisions, relationship building).

### Constraints

- **Tech stack**: Next.js 14 + FastAPI + Supabase + Google ADK — no migration, improve in place
- **Integrations**: All existing connectors (Vapi, Resend, Apollo, Apify, ProxyCURL, Cal.com) must be preserved and continue working
- **Backend**: FastAPI + Celery + Redis architecture stays — improvements are additive
- **AI**: Google Gemini 2.5 Flash/Pro via ADK — no model migration
- **Database**: Supabase PostgreSQL — schema additions only, no breaking migrations
- **Deployment**: Vercel (frontend) + Railway (backend) — keep existing deployment setup
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
