# TalentAI - Autonomous Talent Acquisition Platform

A multi-agent AI system that automates the end-to-end talent acquisition workflow, from job description creation to offer generation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Google ADK    │ │    Supabase     │ │   Integrations  │
│  (Gemini 2.5)   │ │ (DB + Storage)  │ │ (LinkedIn, etc) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## The Four Agents

| Agent | Purpose |
|-------|---------|
| **JD Assist** | Creates job descriptions from voice/text input |
| **Talent Screener** | Scores and ranks candidates against job requirements |
| **Talent Assessor** | Generates questions, analyzes video assessments |
| **Offer Generator** | Creates compensation packages and offer letters |

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python FastAPI
- **AI Framework**: Google ADK with Gemini 2.5 (`gemini-2.5-flash` / `gemini-2.5-pro-preview-03-25`)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (CVs, videos, documents)
- **Video**: WebRTC + Gemini Vision

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- Google AI API key

### 1. Clone & Setup

```bash
git clone <repo>
cd talent-ai-poc
```

### 2. Supabase Setup

1. Create a new Supabase project
2. Run the migration in `supabase/migrations/001_initial_schema.sql`
3. Create storage buckets: `resumes`, `videos`, `documents`

### 3. Quick Start with Makefile

```bash
# Install all dependencies
make install

# Copy and edit environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit both files with your keys

# Run both servers
make dev
```

### 3b. Backend Setup (Manual)

```bash
cd backend
uv sync  # Install dependencies

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your keys

# Run the server
uv run uvicorn app.main:app --reload
```

### 4. Frontend Setup (Manual)

```bash
cd frontend
npm install

# Copy and edit environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Run the development server
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Project Structure

```
talent-ai-poc/
├── frontend/           # Next.js application
│   ├── app/           # App Router pages
│   ├── components/    # React components
│   ├── lib/           # Utilities
│   └── hooks/         # Custom hooks
│
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── api/       # API endpoints
│   │   ├── agents/    # AI agents
│   │   ├── models/    # Database models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   └── tests/
│
├── docs/              # Documentation
│   ├── SYSTEM_DESIGN.md
│   ├── TECH_STACK.md
│   ├── UX_SPEC.md
│   ├── AGENT_SPECS.md
│   └── CLAUDE_CODE_INSTRUCTIONS.md
│
└── supabase/          # Database migrations
```

## Documentation

- [System Design](docs/SYSTEM_DESIGN.md) - Architecture, data models, APIs
- [Tech Stack](docs/TECH_STACK.md) - Dependencies, setup, patterns
- [UX Specification](docs/UX_SPEC.md) - Screens, flows, design system
- [Agent Specifications](docs/AGENT_SPECS.md) - Agent prompts, I/O, tools
- [Claude Code Instructions](docs/CLAUDE_CODE_INSTRUCTIONS.md) - Development guide

## Environment Variables

### Backend (.env)

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
GOOGLE_API_KEY=AIza...
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Development

### Using Makefile (Recommended)

```bash
make test      # Run all tests
make lint      # Run linters
make format    # Format code
```

### Running Tests (Manual)

```bash
# Backend
cd backend
uv run pytest

# Frontend
cd frontend
npm test
```

### Code Formatting (Manual)

```bash
# Backend
cd backend
uv run black .
uv run ruff check .

# Frontend
cd frontend
npm run lint
npm run format
```

## License

MIT
