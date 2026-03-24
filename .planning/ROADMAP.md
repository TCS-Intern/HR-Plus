# Roadmap: Talentic — UX + Sourcing + Assessment Upgrade

## Overview

Starting from a full-featured but visually generic MVP, this milestone transforms Talentic into a premium-feeling autonomous recruitment platform. The work runs in five phases: first establishing the design system and navigation that everything else builds on, then delivering the candidate timeline and AI assistant that define the core UX identity, then upgrading sourcing into a persistent talent intelligence layer, then extending video assessment with behavioral profiling, and finally capping the build with interview intelligence, velocity analytics, candidate experience polish, and integration verification. Every existing integration (Vapi, Resend, Apollo, Apify, ProxyCURL, Cal.com) is preserved throughout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Design System + Navigation** - Establish the visual foundation and workflow-oriented navigation that all subsequent phases render on top of
- [ ] **Phase 2: Candidate Timeline + AI Assistant** - Deliver the core UX differentiators: unified candidate history and a named AI assistant with proactive intelligence
- [ ] **Phase 3: Sourcing Upgrade** - Expand discovery beyond LinkedIn/GitHub, build persistent talent pools, and promote conversational sourcing as the primary interface
- [ ] **Phase 4: Behavioral Assessment** - Extend Gemini video analysis with DISC-style profiling, role behavioral profiles, and fit scoring
- [ ] **Phase 5: Intelligence, Analytics + Polish** - Add interview prep/summary intelligence, velocity dashboard, candidate experience pages, pipeline alerts, and verify all integrations are intact

## Phase Details

### Phase 1: Design System + Navigation
**Goal**: The platform looks and feels premium — recruiters see a warm, polished interface with workflow-oriented navigation and consistent micro-interactions across every page
**Depends on**: Nothing (first phase)
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. Every page uses the new color palette, Plus Jakarta Sans typography, and rounded card components — no default Tailwind gray or unstyled Shadcn elements visible
  2. The sidebar groups navigation by workflow phase (Source → Screen → Assess → Hire → Analytics) and collapses cleanly on mobile
  3. The dashboard opens to an action-first view showing candidates awaiting review, campaigns needing responses, expiring offers, and today's interviews — not a metrics overview
  4. A recruiter landing on the platform for the first time is guided through a "create your first job" onboarding flow before reaching the main dashboard
  5. All views render correctly on tablet and mobile with no horizontal overflow or broken layouts
**Plans**: TBD

### Phase 2: Candidate Timeline + AI Assistant
**Goal**: Every recruiter interaction with a candidate happens from a single unified page, and a named AI assistant proactively surfaces recommendations and accepts natural language commands from anywhere in the platform
**Depends on**: Phase 1
**Requirements**: CT-01, CT-02, CT-03, CT-04, AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. Opening any candidate shows one page with the complete chronological history — sourced event, every outreach email with open/click status, phone screen transcript, video assessment scores, and offer stage — without navigating away
  2. A recruiter can reply to an email, schedule an interview, advance a pipeline stage, or reject a candidate directly from the timeline without leaving the candidate page
  3. The AI assistant (named, with consistent avatar) appears as a panel accessible from every page and responds to natural language commands like "find me a senior backend engineer in Berlin"
  4. The assistant surfaces proactive notification cards — new matches found, candidates recommended for advancement, campaign performance alerts — without the recruiter asking
  5. Comparing two or three candidates side by side on all scored dimensions (technical fit, behavioral fit, phone screen, assessment) is available from the candidate list
**Plans**: TBD

### Phase 3: Sourcing Upgrade
**Goal**: Sourcing reaches beyond LinkedIn and GitHub to find candidates on the open web, candidate profiles stay fresh automatically, and the conversational sourcing chat is the primary sourcing interface rather than a hidden feature
**Depends on**: Phase 1
**Requirements**: SRC-01, SRC-02, SRC-03, SRC-04, SRC-05, SRC-06, SRC-07
**Success Criteria** (what must be TRUE):
  1. A sourcing search returns candidates found from personal blogs, conference speaker pages, and portfolio sites via Exa.ai — not only LinkedIn and GitHub results
  2. GitHub candidate profiles show commit frequency, repo star counts, inferred tech stack, and contribution quality rather than just a profile link
  3. The sourcing page opens to the conversational chat interface by default; the legacy form-based search is still accessible but not the primary entry point
  4. A recruiter can save candidates to a named talent pool that persists across job postings, with tagging and notes per candidate, and profiles re-enrich automatically on a 30-day cycle
  5. When creating a new job, the platform surfaces candidates from previous searches who match the new requirements — the recruiter does not start from zero
  6. Duplicate candidate profiles sourced across different sessions are detected and can be merged into a single record
**Plans**: TBD

### Phase 4: Behavioral Assessment
**Goal**: Video assessments produce DISC-style behavioral profiles alongside technical scores, recruiters can define the ideal behavioral traits for a role, and candidates are scored against that profile before any interview
**Depends on**: Phase 2
**Requirements**: BA-01, BA-02, BA-03, BA-04, BA-05
**Success Criteria** (what must be TRUE):
  1. After a video assessment is analyzed by Gemini, the candidate card shows a behavioral fit score and a DISC trait breakdown (Dominance, Influence, Steadiness, Conscientiousness) alongside the existing technical fit score
  2. A recruiter setting up a job can define the ideal behavioral profile for the role — selecting which DISC traits to weight — and all assessed candidates are scored against it
  3. The video assessment generator produces situational judgment questions (not only technical/role questions) that surface behavioral tendencies
  4. Each candidate profile includes a plain-language behavioral insights summary such as "Strong communicator, collaborative, may need structure in ambiguous situations"
**Plans**: TBD

### Phase 5: Intelligence, Analytics + Polish
**Goal**: Recruiters walk into every interview with AI-generated prep notes, the platform surfaces pipeline bottlenecks through a velocity dashboard, candidates receive a branded experience and personalized communication, and all six existing integrations are verified working end-to-end
**Depends on**: Phase 4
**Requirements**: INT-01, INT-02, INT-03, INT-04, CX-01, CX-02, CX-03, INTG-01, INTG-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. Before a scheduled interview, the recruiter receives an auto-generated prep brief covering the candidate's profile, phone screen highlights, assessment scores, and suggested questions — without manually compiling it
  2. After an interview, the platform generates a summary and recommendation from interviewer notes or transcript that is saved to the candidate timeline
  3. A hiring velocity dashboard shows time-to-fill by role and source, stage conversion funnel, and flags specific bottlenecks (e.g., "8 candidates stuck in Phone Screen for 7+ days")
  4. Candidate-facing apply, assess, and phone-interview pages display the hiring company's logo, brand colors, and custom messaging — not Talentic branding
  5. Candidates can check their own application status via a secure link without contacting the recruiter
  6. Rejection emails sent from the platform are personalized to the candidate's stage and assessment results, not a generic template
  7. An integration health dashboard shows live status for Vapi, Resend, Apollo, Apify, ProxyCURL, and Cal.com — and all six are confirmed working after the full UX overhaul
  8. Pipeline changes, new candidates, and campaign events update in real time via Supabase subscriptions without a page refresh
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

Note: Phase 3 depends on Phase 1 only (not Phase 2), so Phase 2 and Phase 3 could be sequenced in parallel, but are executed sequentially here for focus.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design System + Navigation | 0/TBD | Not started | - |
| 2. Candidate Timeline + AI Assistant | 0/TBD | Not started | - |
| 3. Sourcing Upgrade | 0/TBD | Not started | - |
| 4. Behavioral Assessment | 0/TBD | Not started | - |
| 5. Intelligence, Analytics + Polish | 0/TBD | Not started | - |
