# Talentic — Autonomous Talent Acquisition Platform

## What This Is

Talentic is an AI-powered autonomous recruitment platform that automates the entire hiring pipeline — from candidate sourcing to offer generation — using multi-agent AI (Google ADK + Gemini). It replaces the fragmented recruiter workflow (LinkedIn Recruiter + email tools + ATS + spreadsheets) with a single platform where AI agents source, screen, assess, phone-screen, and generate offers while the recruiter stays in control. Built for startups, talent acquisition teams, and recruiting agencies.

## Core Value

The platform must make a recruiter feel like they have an **autonomous hiring team** working 24/7 — sourcing candidates, screening resumes, conducting phone screens, analyzing video assessments, and preparing offers — while they only step in for human-judgment moments (interviews, final decisions, relationship building).

## Requirements

### Validated

- ✓ Multi-platform candidate sourcing (LinkedIn/Apify, GitHub, Apollo, ProxyCURL) — existing
- ✓ AI resume screening with fit scoring (0-100) and match breakdown — existing
- ✓ Video assessment generation + Gemini Vision analysis (content, communication, behavioral) — existing
- ✓ AI phone screening via Vapi (natural conversation, transcript analysis, recommendation) — existing
- ✓ Email outreach campaigns with multi-step sequences, tracking, sentiment analysis — existing
- ✓ Offer generation with comp packages, negotiation guidance, offer letters — existing
- ✓ Interview scheduling via Cal.com integration — existing
- ✓ Pipeline Kanban board (Sourced → Contacted → Replied → Phone Screen → Ready → Offer → Hired) — existing
- ✓ Candidate packets for hiring managers with comparison matrices — existing
- ✓ Marathon Agent (autonomous multi-day hiring orchestration with self-correction) — existing
- ✓ JD Assist Agent (voice/text to structured job descriptions) — existing
- ✓ Supabase auth + PostgreSQL database with full schema — existing
- ✓ Background jobs via Celery + Redis — existing
- ✓ Conversational sourcing chat backend — existing

### Active

**UX Overhaul:**
- [ ] Design system refresh — custom color palette, typography (Plus Jakarta Sans), spacing, micro-interactions, warm premium aesthetic
- [ ] Action-first dashboard — lead with "what needs attention" (candidates awaiting review, campaigns needing responses, offers expiring) not metrics
- [ ] Unified candidate timeline — single page per candidate aggregating all touchpoints (sourced, outreach, opens, replies, phone screen, assessment, offer)
- [ ] Named AI assistant ("Aira" or chosen name) with avatar, proactive notifications, personality in UI
- [ ] First-run onboarding experience — guided "create your first job" flow with progressive disclosure
- [ ] Micro-interactions — Framer Motion page transitions, skeleton loaders, toast notifications, pipeline drag-and-drop polish
- [ ] Navigation redesign — reduce sidebar items, group by workflow phase (Source → Screen → Assess → Hire) not feature type
- [ ] Empty states with personality — helpful illustrations and CTAs instead of blank tables
- [ ] Candidate-facing branding — white-label apply/assess/phone-interview pages with company logo + colors

**Candidate Sourcing Improvements:**
- [ ] Broader web sourcing — Exa.ai or Tavily for semantic web search (personal blogs, portfolios, conference speakers, beyond LinkedIn/GitHub)
- [ ] GitHub deep enrichment — commit frequency, repo stars, contribution quality, tech stack inference from repos
- [ ] Auto-refresh candidate profiles — cron job re-enriching sourced candidates every 30 days (catch job changes)
- [ ] Talent pool / CRM — saved candidate pools that persist across jobs, auto-refresh, with tagging
- [ ] Conversational sourcing as primary UI — promote the chat-based sourcing to the main sourcing interface (backend exists)

**Behavioral Assessment (PDP-inspired):**
- [ ] Behavioral assessment dimensions — extend video analysis to infer DISC-style traits (Dominance, Influence, Steadiness, Conscientiousness)
- [ ] Role behavioral profile — define ideal behavioral traits per role, score candidates against them
- [ ] Behavioral fit score — display alongside technical fit on candidate cards
- [ ] Assessment question types — add situational judgment and behavioral questions to video assessment generation

**Intelligence & Analytics:**
- [ ] Interview assistant — auto-generate prep notes from candidate's full profile + screening + assessment before each interview, auto-summarize after
- [ ] Hiring velocity dashboard — time-to-fill, stage conversion rates, source effectiveness, bottleneck detection
- [ ] AI-generated rejection emails — personalized based on stage and assessment results, not templates
- [ ] Smart candidate recommendations — "Candidates from previous searches who match this new role"

**Polish & Infrastructure:**
- [ ] Mobile-responsive dashboard — ensure all views work on tablet/mobile
- [ ] Real-time updates — Supabase realtime subscriptions for pipeline changes, new candidates, campaign events
- [ ] Unified inbox — LinkedIn DMs + email + phone in one thread per candidate (UI layer)

### Out of Scope

- Complete UI rewrite from scratch — improving existing Next.js app, not rebuilding
- Custom ATS for enterprise — focus on startup/SMB and agency market
- Building own LLM — Google Gemini via ADK is the AI layer
- Social recruiting features (employee referrals, social sharing) — v2
- Multi-language UI — English only for v1
- HRIS integration (BambooHR, Workday) — v2 after core UX is solid

## Context

- **Competitive reference:** Talentium (Stockholm, $11.1M raised, EQT Ventures) — superior UX, warm aesthetic, named AI "Ted", unified inbox, employer branding. They are sourcing-first; Talentic is full-pipeline. UX is the gap.
- **Current state:** Full-featured MVP with 25+ pages, 4 AI agents, 6 external integrations (Vapi, Resend, Apollo, Apify, ProxyCURL, Cal.com). Backend is strong. Frontend is functional but generic (standard Tailwind/Shadcn).
- **Existing integrations to preserve:** Vapi (phone), Resend (email), Apollo (sourcing), Apify (LinkedIn), ProxyCURL (enrichment), Cal.com (scheduling), Supabase (DB/auth/storage), Google Gemini (AI).
- **PDP reference:** PDP Global uses behavioral profiling to match candidates to roles. The approach is to build this natively using Gemini's video analysis capabilities rather than integrating an external assessment platform.

## Constraints

- **Tech stack**: Next.js 14 + FastAPI + Supabase + Google ADK — no migration, improve in place
- **Integrations**: All existing connectors (Vapi, Resend, Apollo, Apify, ProxyCURL, Cal.com) must be preserved and continue working
- **Backend**: FastAPI + Celery + Redis architecture stays — improvements are additive
- **AI**: Google Gemini 2.5 Flash/Pro via ADK — no model migration
- **Database**: Supabase PostgreSQL — schema additions only, no breaking migrations
- **Deployment**: Vercel (frontend) + Railway (backend) — keep existing deployment setup

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| UX refresh over rebuild | Existing Next.js app has 25+ pages of working features — refresh design system, don't rewrite | — Pending |
| Named AI assistant | Talentium's "Ted" proves that giving AI a name/personality increases trust and engagement | — Pending |
| Build behavioral assessment natively | Extend existing Gemini video analysis rather than integrating PDP/external platform — lower cost, tighter integration | — Pending |
| Exa.ai for web sourcing | Semantic search beyond LinkedIn/GitHub APIs — finds portfolios, conference talks, blog posts | — Pending |
| Preserve all existing integrations | 6 connectors already working — zero tolerance for breaking them during UX overhaul | — Pending |
| Framer Motion for micro-interactions | Already in Next.js ecosystem, lightweight, handles page transitions + skeleton loaders well | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after initialization*
