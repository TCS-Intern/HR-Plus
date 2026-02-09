# Telentic - Autonomous Talent Acquisition Platform

An AI-powered recruitment platform that automates the entire hiring pipeline from candidate sourcing to offer generation using multi-agent AI systems.

## Features

### V2 Recruiting Pipeline

| Stage | Description |
|-------|-------------|
| **Sourcing** | Search and discover candidates across platforms (LinkedIn, GitHub, Indeed), AI-score fit against job requirements |
| **Campaigns** | Multi-step email outreach sequences with personalization, delivery tracking, and engagement analytics |
| **Phone Screening** | AI-powered voice calls via Vapi that probe skills and generate recommendations (STRONG_YES/YES/MAYBE/NO) |
| **Offer Generation** | Create competitive compensation packages and professional offer letters |

### AI Agents

| Agent | Description |
|-------|-------------|
| **Talent Screener** | Scores sourced candidates against job requirements with detailed fit reasoning |
| **Phone Screen Agent** | Analyzes call transcripts for skills, compensation expectations, red flags, and communication quality |
| **Offer Generator** | Creates compensation packages based on market data and candidate expectations |

### Key Capabilities

- **Multi-Platform Sourcing** - Search LinkedIn, GitHub, Indeed, Glassdoor, AngelList
- **AI Candidate Scoring** - Automatic fit scoring with detailed reasoning
- **Email Campaigns** - Multi-step sequences with Resend tracking (opens, clicks, replies)
- **AI Phone Screens** - Vapi-powered calls with transcript analysis and recommendations
- **Pipeline Kanban** - Visual board tracking candidates through Sourced → Contacted → Replied → Phone Screen → Ready
- **Real-time Dashboard** - Live metrics, pipeline status, and agent activity

## Architecture

### V2 Pipeline Flow

```
JOB CREATED
    ↓
SOURCING ──────────────────────────────────────────────────────
├─ Search candidates across platforms (LinkedIn, GitHub, etc.)
├─ Import and deduplicate candidates
└─ AI-score candidates using Talent Screener agent
    ↓
CAMPAIGNS ─────────────────────────────────────────────────────
├─ Create multi-step email sequences
├─ Add sourced candidates as recipients
├─ Send personalized emails with Resend tracking
└─ Track: delivered → opened → clicked → replied
    ↓
PHONE SCREEN ──────────────────────────────────────────────────
├─ Schedule AI voice calls via Vapi
├─ Probe job-relevant skills in conversation
├─ Capture transcript and call metadata
├─ Phone Screen Agent analyzes and scores
└─ Generate recommendation: STRONG_YES / YES / MAYBE / NO
    ↓
OFFER GENERATION ──────────────────────────────────────────────
├─ Generate compensation package
└─ Create and send offer letter
```

### Key Integrations

| Service | Purpose |
|---------|---------|
| **Vapi** | AI phone calling and real-time transcription |
| **Resend** | Email delivery with webhook tracking |
| **Google ADK** | Agent orchestration with Gemini 2.5 |
| **Supabase** | Database, auth, storage, real-time updates |

## Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **Google ADK** - Agent Development Kit with Gemini 2.5 Flash/Pro
- **Supabase** - PostgreSQL database + file storage
- **Pydantic** - Data validation and serialization

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### Infrastructure
- **Supabase** - Database, auth, real-time subscriptions, and storage
- **Vercel** - Frontend deployment
- **Railway** - Backend deployment

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account
- Google AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TCS-Intern/HR-Plus.git
   cd HR-Plus
   ```

2. **Backend Setup**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your credentials
   uv sync
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Database Setup**
   - Create a Supabase project
   - Run the migration in `files/001_initial_schema.sql`
   - Create storage buckets: `resumes`, `videos`, `documents`

### Environment Variables

**Backend (.env)**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
GOOGLE_API_KEY=your-google-api-key
GEMINI_MODEL=gemini-2.5-flash
```

**Frontend (.env.local)**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Running the Application

**Using Make (recommended)**
```bash
make dev  # Runs both backend and frontend
```

**Manual**
```bash
# Terminal 1 - Backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

## Project Structure

```
HR-Plus/
├── backend/
│   ├── app/
│   │   ├── agents/              # AI agent implementations
│   │   │   ├── talent_screener.py   # Candidate scoring
│   │   │   ├── phone_screen_agent.py # Call transcript analysis
│   │   │   ├── offer_generator.py   # Compensation packages
│   │   │   └── coordinator.py       # Agent orchestration
│   │   ├── api/v1/              # REST API endpoints
│   │   │   ├── sourcing.py          # Candidate sourcing
│   │   │   ├── campaigns.py         # Email campaigns
│   │   │   ├── phone_screen.py      # AI phone screens
│   │   │   └── offers.py            # Offer management
│   │   ├── schemas/             # Pydantic models
│   │   └── services/            # Database, Vapi, Resend
│   └── pyproject.toml
│
├── frontend/
│   ├── app/
│   │   ├── (dashboard)/         # Main dashboard pages
│   │   │   ├── sourcing/            # Candidate sourcing
│   │   │   ├── campaigns/           # Email campaigns
│   │   │   ├── phone-screens/       # AI phone screens
│   │   │   ├── pipeline/            # Kanban board
│   │   │   └── offers/              # Offer management
│   │   └── jobs/                # Job management
│   ├── components/              # Reusable UI components
│   └── types/                   # TypeScript definitions
│
└── files/
    ├── 001_initial_schema.sql   # Database schema
    ├── AGENT_SPECS.md           # Agent specifications
    └── SYSTEM_DESIGN.md         # Architecture docs
```

## API Endpoints

### Sourcing
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sourcing/search` | POST | Search candidates across platforms |
| `/api/v1/sourcing/import` | POST | Import search results as candidates |
| `/api/v1/sourcing/{id}/score` | POST | AI-score candidate fit |
| `/api/v1/sourcing/bulk-score` | POST | Score multiple candidates |
| `/api/v1/sourcing/{id}/convert` | POST | Convert to application |

### Campaigns
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/campaigns` | POST | Create email campaign |
| `/api/v1/campaigns/{id}/recipients` | POST | Add candidates to campaign |
| `/api/v1/campaigns/{id}/send` | POST | Send pending messages |
| `/api/v1/campaigns/webhook/resend` | POST | Handle email events |

### Phone Screens
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/phone-screen/schedule` | POST | Schedule AI phone call |
| `/api/v1/phone-screen/webhook` | POST | Handle Vapi call events |
| `/api/v1/phone-screen/{id}/approve` | POST | Approve for offer stage |
| `/api/v1/phone-screen/{id}/reject` | POST | Reject candidate |

### Offers
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/offer/generate` | POST | Generate offer package |
| `/api/v1/dashboard/metrics` | GET | Get dashboard metrics |

## Usage Flow

1. **Create Job** → Define role requirements and skills
2. **Source Candidates** → Search across LinkedIn, GitHub, Indeed
3. **Score & Filter** → AI scores candidates against job requirements
4. **Run Campaigns** → Send personalized email sequences
5. **Phone Screen** → AI calls interested candidates, analyzes responses
6. **Review Results** → Check recommendations (STRONG_YES/YES/MAYBE/NO)
7. **Generate Offer** → Create compensation package for approved candidates
8. **Track Pipeline** → Monitor candidates through Kanban board

## Screenshots

### Pipeline Kanban
Visual board tracking candidates through Sourced → Contacted → Replied → Phone Screen → Ready stages.

### Sourcing
Multi-platform candidate search with AI fit scoring and skills matching.

### Campaigns
Email sequence builder with delivery tracking and engagement analytics.

### Phone Screens
AI call results with recommendations, transcript analysis, and skill assessments.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License

## Acknowledgments

- [Google ADK](https://github.com/google/adk-python) for AI agent orchestration
- [Vapi](https://vapi.ai) for AI phone calling
- [Resend](https://resend.com) for email delivery
- [Supabase](https://supabase.com) for backend infrastructure
- [Lucide](https://lucide.dev/) for icons
