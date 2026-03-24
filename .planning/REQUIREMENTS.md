# Requirements

**Project:** Talentic — Autonomous Talent Acquisition Platform
**Version:** v1 UX + Sourcing + Assessment Upgrade
**Last updated:** 2026-03-24

---

## v1 Requirements

### Design System
- [ ] **DS-01**: Custom color palette replacing default Tailwind — warm, premium tones (cream, sage, charcoal) with accent colors for actions
- [ ] **DS-02**: Typography system using Plus Jakarta Sans (or chosen font) with clear hierarchy (display, heading, body, caption)
- [ ] **DS-03**: Component library refresh — rounded cards, subtle shadows, glassmorphism accents, consistent spacing scale
- [ ] **DS-04**: Micro-interaction system using Framer Motion — page transitions, hover states, skeleton loaders, toast notifications
- [ ] **DS-05**: Dark mode support with proper color token system
- [ ] **DS-06**: Empty states with illustrations and contextual CTAs for every list/table view

### Dashboard & Navigation
- [ ] **NAV-01**: Sidebar redesign — group by workflow phase (Source → Screen → Assess → Hire → Analytics) with collapsible sections
- [ ] **NAV-02**: Action-first dashboard — "What needs attention" cards: candidates awaiting review, campaigns needing responses, offers expiring, interviews today
- [ ] **NAV-03**: Global search — search candidates, jobs, campaigns from any page
- [ ] **NAV-04**: First-run onboarding — guided "create your first job" flow for new users with progressive disclosure
- [ ] **NAV-05**: Mobile-responsive layout — all dashboard views work on tablet and mobile

### AI Assistant
- [ ] **AI-01**: Named AI assistant (e.g., "Aira") with consistent avatar/icon across the platform
- [ ] **AI-02**: Proactive notification cards — "Aira found 3 new matches", "Aira recommends advancing Sarah", "Campaign reply rate above 40%"
- [ ] **AI-03**: Assistant panel accessible from any page — chat-style interface for natural language commands ("find me a senior backend engineer in Paris")
- [ ] **AI-04**: AI-generated contextual suggestions — next best action per candidate, per job, per campaign

### Candidate Timeline
- [ ] **CT-01**: Unified candidate profile page — single view aggregating all touchpoints (sourced, outreach emails, opens/clicks, replies, phone screen transcript, video assessment, scores, offer)
- [ ] **CT-02**: Activity timeline with timestamps showing every interaction chronologically
- [ ] **CT-03**: Inline actions from timeline — reply to email, schedule interview, advance stage, reject — without leaving the page
- [ ] **CT-04**: Candidate comparison view — side-by-side comparison of 2-3 candidates on all dimensions

### Candidate Sourcing
- [ ] **SRC-01**: Semantic web search via Exa.ai — find candidates from personal blogs, portfolios, conference talks, not just LinkedIn/GitHub
- [ ] **SRC-02**: GitHub deep enrichment — commit frequency, repo quality, tech stack inference, contribution patterns
- [ ] **SRC-03**: Auto-refresh candidate profiles — 30-day cron re-enrichment via Apollo/ProxyCURL to catch job changes
- [ ] **SRC-04**: Talent pool / CRM — persistent candidate pools across jobs with tagging, notes, and auto-refresh
- [ ] **SRC-05**: Conversational sourcing as primary interface — promote chat-based sourcing UI (backend exists at /api/v1/sourcing-chat)
- [ ] **SRC-06**: Smart candidate recommendations — surface candidates from previous searches who match new job requirements
- [ ] **SRC-07**: Candidate deduplication with merge — detect duplicates across sourcing sessions, merge profiles

### Behavioral Assessment
- [ ] **BA-01**: DISC-style behavioral dimensions inferred from video assessment responses using Gemini analysis
- [ ] **BA-02**: Role behavioral profile — recruiters define ideal behavioral traits per role (e.g., high Influence for sales, high Conscientiousness for finance)
- [ ] **BA-03**: Behavioral fit score displayed alongside technical fit score on candidate cards and comparison views
- [ ] **BA-04**: Situational judgment questions added to video assessment generation (e.g., "A colleague disagrees with your approach. Walk me through how you handle it.")
- [ ] **BA-05**: Behavioral insights summary on candidate profile — "Strong communicator, collaborative, may need structure in ambiguous environments"

### Candidate Experience
- [ ] **CX-01**: White-label candidate-facing pages — company logo, colors, and custom messaging on apply/assess/phone-interview pages
- [ ] **CX-02**: Candidate status portal — candidates can check their application status via a secure link
- [ ] **CX-03**: AI-generated personalized rejection emails — based on stage reached and assessment results, not generic templates

### Intelligence & Analytics
- [ ] **INT-01**: Interview prep notes — auto-generated from candidate's full profile, screening, phone screen, and assessment before each interview
- [ ] **INT-02**: Interview summary — auto-capture key points and recommendation after interview (from interviewer notes or transcript)
- [ ] **INT-03**: Hiring velocity dashboard — time-to-fill by role/source, stage conversion funnel, bottleneck detection, source effectiveness
- [ ] **INT-04**: Smart pipeline alerts — "3 candidates stuck in screening for 5+ days", "Campaign open rate below 20%"

### Integration Preservation
- [ ] **INTG-01**: All existing integrations verified working after UX changes (Vapi, Resend, Apollo, Apify, ProxyCURL, Cal.com)
- [ ] **INTG-02**: Integration health dashboard — status indicators for each connected service
- [ ] **INTG-03**: Supabase realtime subscriptions for pipeline changes, new candidates, campaign events

---

## v2 Requirements (Deferred)

- Social recruiting (employee referrals, social sharing)
- HRIS integration (BambooHR, Workday, Rippling)
- Multi-language UI
- Custom workflow builder (beyond Kanban stages)
- Client portal for recruiting agencies
- Slack/Teams integration for notifications
- Codility/HackerRank integration for technical assessments
- Full PDP Global or Predictive Index API integration

---

## Out of Scope

- Complete frontend rewrite — design system refresh on existing Next.js app
- Building own LLM — Google Gemini via ADK is the AI layer
- Breaking existing API contracts — all backend endpoints must maintain backwards compatibility
- Enterprise SSO/SAML — v2 feature
- On-premise deployment — SaaS only (Vercel + Railway)

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DS-01 | Phase 1 | Pending |
| DS-02 | Phase 1 | Pending |
| DS-03 | Phase 1 | Pending |
| DS-04 | Phase 1 | Pending |
| DS-05 | Phase 1 | Pending |
| DS-06 | Phase 1 | Pending |
| NAV-01 | Phase 1 | Pending |
| NAV-02 | Phase 1 | Pending |
| NAV-03 | Phase 1 | Pending |
| NAV-04 | Phase 1 | Pending |
| NAV-05 | Phase 1 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 2 | Pending |
| AI-04 | Phase 2 | Pending |
| CT-01 | Phase 2 | Pending |
| CT-02 | Phase 2 | Pending |
| CT-03 | Phase 2 | Pending |
| CT-04 | Phase 2 | Pending |
| SRC-01 | Phase 3 | Pending |
| SRC-02 | Phase 3 | Pending |
| SRC-03 | Phase 3 | Pending |
| SRC-04 | Phase 3 | Pending |
| SRC-05 | Phase 3 | Pending |
| SRC-06 | Phase 3 | Pending |
| SRC-07 | Phase 3 | Pending |
| BA-01 | Phase 4 | Pending |
| BA-02 | Phase 4 | Pending |
| BA-03 | Phase 4 | Pending |
| BA-04 | Phase 4 | Pending |
| BA-05 | Phase 4 | Pending |
| INT-01 | Phase 5 | Pending |
| INT-02 | Phase 5 | Pending |
| INT-03 | Phase 5 | Pending |
| INT-04 | Phase 5 | Pending |
| CX-01 | Phase 5 | Pending |
| CX-02 | Phase 5 | Pending |
| CX-03 | Phase 5 | Pending |
| INTG-01 | Phase 5 | Pending |
| INTG-02 | Phase 5 | Pending |
| INTG-03 | Phase 5 | Pending |

---
