# TalentAI - Hackathon Status

**Last Updated:** February 2, 2026

## System Overview

TalentAI is a multi-agent AI system that automates talent acquisition from job description creation to offer generation. Uses Google ADK with Gemini, Supabase, Next.js 14, and FastAPI.

---

## ✅ Features Ready for Demo

| Feature | Status | Notes |
|---------|--------|-------|
| **Sourcing Chatbot** | ✅ Complete | AI-powered candidate search with streaming responses |
| **Video Assessment** | ✅ Complete | Gemini Vision analyzes candidate video responses |
| **JD Creation** | ✅ Complete | Voice/text to structured job description with skills matrix |
| **Resume Screening** | ✅ Complete | AI scoring and ranking of candidates |
| **Offer Generation** | ✅ Complete | HTML offer letter templates |
| **Dashboard** | ✅ Complete | Metrics, pipeline overview, activity feed |
| **Marathon Agent** | ✅ Complete | Autonomous multi-day hiring decisions |
| **Email Service** | ✅ Complete | Assessment invites, offer letters (needs SendGrid key) |
| **Campaigns** | ✅ Complete | Email outreach sequences |
| **Phone Screens** | ✅ Complete | Vapi integration for AI phone interviews |

---

## Architecture

### Four Core Agents (Sequential Pipeline)
1. **JD Assist** - Voice/text → structured job description with skills matrix
2. **Talent Screener** - CVs → scored/ranked candidates
3. **Talent Assessor** - Generates questions, analyzes video responses via Gemini Vision
4. **Offer Generator** - Creates compensation packages and offer letters

### Flow
```
JD Created → Approved → Screening → Shortlist Approved → Assessment → Complete → Offer
```

---

## Deployment Status

| Platform | Status | URL |
|----------|--------|-----|
| **Frontend (Vercel)** | ✅ Deployed | https://frontend-95hg0j9mp-bloqai.vercel.app |
| **Backend (Railway)** | ✅ Deployed | talentai-backend on Railway |
| **Database (Supabase)** | ✅ Active | okgawabbcktuvmqqtbzr.supabase.co |

---

## Environment Variables Required

### Critical (Must Have)
- `GOOGLE_API_KEY` - For Gemini AI agents ✅ Configured
- `SUPABASE_URL` - Database connection ✅ Configured
- `SUPABASE_SERVICE_KEY` - Database auth ✅ Configured

### For Full Features
- `SENDGRID_API_KEY` - Email notifications
- `VAPI_API_KEY` - Phone screening AI
- `APIFY_API_TOKEN` - LinkedIn candidate sourcing ✅ Configured

---

## Demo Walkthrough

### 1. Sourcing Chatbot
- Navigate to `/jobs/new`
- Chat: "I need an AI engineer with Python skills, 5 years experience, remote"
- AI finds and displays anonymized candidates
- Reveal candidate details with credits

### 2. Create Job Description
- Use classic form or chat interface
- AI generates structured JD with skills matrix
- Review and approve

### 3. Screen Candidates
- Upload resumes or source from chatbot
- AI scores and ranks candidates
- Review shortlist

### 4. Video Assessment
- Schedule assessment for candidate
- Candidate records video responses
- Gemini Vision analyzes: communication, behavior, content
- Get recommendation: STRONG_YES, YES, MAYBE, NO

### 5. Generate Offer
- Select approved candidate
- AI generates compensation package
- Send offer letter via email

---

## 🔧 Minor Improvements (Optional)

1. **Campaign send_on_days** - Currently sends immediately, not day-specific
2. **JD similar search** - Uses mock data (functional but not DB-backed)
3. **Fit score calculation** - Placeholder value in sourcing

---

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, Python 3.11, Google ADK
- **AI:** Gemini 2.0 Flash (configurable)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (videos, resumes)
- **Email:** SendGrid
- **Phone AI:** Vapi
- **Sourcing:** Apify (LinkedIn scraper)

---

## Completeness: ~85-90%

The system is ready for hackathon demonstration with all core hiring pipeline features functional.
