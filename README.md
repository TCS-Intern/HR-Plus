# TalentAI - Autonomous Talent Acquisition Platform

An AI-powered recruitment platform that automates the entire hiring pipeline from job description creation to offer generation using multi-agent AI systems.

## Features

### 4 AI Agents

| Agent | Description |
|-------|-------------|
| **JD Assist** | Converts voice/text input into structured job descriptions with skills matrices and evaluation criteria |
| **Talent Screener** | Parses CVs, scores candidates against job requirements, and provides match breakdowns |
| **Talent Assessor** | Generates interview questions and analyzes video responses using AI vision |
| **Offer Generator** | Creates competitive compensation packages and professional offer letters |

### Key Capabilities

- **Voice Input** - Speak your job requirements using Web Speech API
- **CV Parsing** - Automatic extraction from PDF/DOCX resumes
- **Skills Matrix** - Weighted skill requirements with proficiency levels
- **Video Assessments** - Record and AI-analyze candidate responses
- **Real-time Dashboard** - Live metrics, pipeline status, and agent activity
- **Offer Management** - Track negotiations and offer statuses

## Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **Google ADK** - Agent Development Kit with Gemini 2.5 Flash
- **Supabase** - PostgreSQL database + file storage
- **Pydantic** - Data validation and serialization

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### Infrastructure
- **Supabase** - Database, auth, and storage
- **Redis** - Background task queue (Celery)

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
│   │   ├── agents/          # AI agent implementations
│   │   │   ├── jd_assist.py
│   │   │   ├── talent_screener.py
│   │   │   ├── talent_assessor.py
│   │   │   ├── offer_generator.py
│   │   │   └── coordinator.py
│   │   ├── api/v1/          # REST API endpoints
│   │   ├── schemas/         # Pydantic models
│   │   └── services/        # Database & storage
│   └── pyproject.toml
│
├── frontend/
│   ├── app/
│   │   ├── (dashboard)/     # Main dashboard pages
│   │   │   ├── jobs/        # Job management
│   │   │   ├── assessments/ # Video assessments
│   │   │   └── offers/      # Offer management
│   │   └── assess/[token]/  # Candidate video recording
│   ├── components/          # Reusable UI components
│   └── types/               # TypeScript definitions
│
└── files/
    ├── 001_initial_schema.sql  # Database schema
    ├── AGENT_SPECS.md          # Agent specifications
    └── SYSTEM_DESIGN.md        # Architecture docs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/jd/create` | POST | Generate job description from text/voice |
| `/api/v1/jd/{id}` | GET | Get job details |
| `/api/v1/screen/upload-cv` | POST | Upload and screen a CV |
| `/api/v1/screen/{job_id}/candidates` | GET | Get screened candidates |
| `/api/v1/assess/generate-questions` | POST | Generate assessment questions |
| `/api/v1/assess/submit-video` | POST | Submit video response |
| `/api/v1/offer/generate` | POST | Generate offer package |
| `/api/v1/dashboard/metrics` | GET | Get dashboard metrics |

## Usage Flow

1. **Create Job** → Use voice or text to describe the role
2. **Review & Approve** → Edit generated JD and activate
3. **Screen Candidates** → Upload CVs for AI scoring
4. **Shortlist** → Select top candidates for assessment
5. **Assess** → Send video interview invitations
6. **Analyze** → AI evaluates video responses
7. **Offer** → Generate and send offer packages
8. **Track** → Monitor offer status and negotiations

## Screenshots

### Dashboard
Real-time metrics showing active jobs, candidates in pipeline, and agent activity.

### JD Builder
Voice input interface with live transcription and AI-generated job descriptions.

### Candidate Screening
CV upload with automatic parsing and match score visualization.

### Video Assessment
Candidate recording interface with question display and timer.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software developed for TCS.

## Acknowledgments

- Built with [Google ADK](https://github.com/google/adk-python) for AI agents
- UI components inspired by modern glass morphism design
- Icons from [Lucide](https://lucide.dev/)
