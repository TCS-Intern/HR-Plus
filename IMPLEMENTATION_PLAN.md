# TalentAI Full Integration Implementation Plan

## Overview
This plan organizes all remaining work into 8 parallel work streams that can be developed simultaneously using git worktrees.

---

## Work Streams

### Stream 1: `feature/resume-parsing` - Resume Parsing Implementation
**Priority:** Critical | **Complexity:** Medium | **Est. Files:** 3-4

**Tasks:**
1. Implement `parse_resume()` in `backend/app/agents/tools/screening_tools.py`
   - Use pypdf for PDF extraction
   - Use python-docx for DOCX extraction
   - Extract: contact info, experience, education, skills, certifications
   - Return structured data matching current schema

2. Create resume parsing service `backend/app/services/resume_parser.py`
   - Modular extraction functions
   - Error handling for corrupt files
   - Support for multiple formats

3. Update screening endpoint to use real parsing
   - `backend/app/api/v1/screening.py` - integrate parser in upload-cv

4. Add tests for resume parsing

**Dependencies:** pypdf, python-docx (already in pyproject.toml)

---

### Stream 2: `feature/video-analysis` - Gemini Vision Video Analysis
**Priority:** Critical | **Complexity:** High | **Est. Files:** 4-5

**Tasks:**
1. Implement `analyze_video_segment()` in `backend/app/agents/tools/assessment_tools.py`
   - Use Gemini Vision API for frame analysis
   - Analyze: body language, eye contact, confidence
   - Return structured behavioral analysis

2. Implement `transcribe_audio()` in same file
   - Use Gemini for audio transcription
   - Return timestamped transcript segments

3. Create video analysis service `backend/app/services/video_analyzer.py`
   - Frame extraction from video URL
   - Segment analysis orchestration
   - Result aggregation

4. Update assessment endpoint `backend/app/api/v1/assessment.py`
   - Wire up analyze_video_async with real implementation
   - Store analysis results in database

5. Add comprehensive video analysis tests

**Dependencies:** google-generativeai (Gemini)

---

### Stream 3: `feature/email-integration` - Email Sending Implementation
**Priority:** Critical | **Complexity:** Low | **Est. Files:** 3-4

**Tasks:**
1. Implement offer email sending in `backend/app/api/v1/offer.py:226`
   - Use SendGrid service already created
   - Create professional offer email template
   - Include offer letter as attachment

2. Implement assessment invitation emails
   - `backend/app/api/v1/assessment.py` - send_assessment_invite
   - Create assessment invitation template

3. Create email templates directory `backend/templates/emails/`
   - offer_letter.html
   - assessment_invite.html
   - campaign_outreach.html

4. Add email sending to campaign workflow
   - Wire up `backend/app/api/v1/campaigns.py` with real sending

**Dependencies:** SendGrid SDK (configured)

---

### Stream 4: `feature/candidate-sourcing` - External Platform Integration
**Priority:** Critical | **Complexity:** High | **Est. Files:** 5-6

**Tasks:**
1. Implement Apollo.io integration `backend/app/services/apollo.py`
   - People search API
   - Email enrichment
   - Contact information retrieval

2. Implement GitHub profile search `backend/app/services/github_search.py`
   - Search users by skills/location
   - Fetch public profile data
   - Extract contribution history

3. Update sourcing endpoint `backend/app/api/v1/sourcing.py:60`
   - Integrate Apollo search
   - Integrate GitHub search
   - Combine and deduplicate results

4. Implement LinkedIn enrichment `backend/app/agents/tools/screening_tools.py:44`
   - Via RapidAPI or Proxycurl
   - Profile data extraction

5. Add sourcing service tests

**Dependencies:** Apollo API key, GitHub token, RapidAPI key

---

### Stream 5: `feature/auth-middleware` - Authentication Layer
**Priority:** Critical | **Complexity:** Medium | **Est. Files:** 6-8

**Tasks:**
1. Create auth middleware `backend/app/middleware/auth.py`
   - JWT validation with Supabase
   - User context extraction
   - Role-based access control

2. Protect all API routes
   - Add dependency injection for authenticated routes
   - Implement role checks (admin, recruiter, hiring_manager)

3. Frontend auth integration `frontend/lib/auth/`
   - Supabase auth client setup
   - Auth context provider
   - Protected route wrapper

4. Update frontend layout with real user data
   - `frontend/app/(dashboard)/layout.tsx`
   - User avatar, logout button

5. Add login/logout pages
   - `frontend/app/login/page.tsx`
   - `frontend/app/logout/page.tsx`

6. Implement session management

**Dependencies:** @supabase/auth-helpers-nextjs

---

### Stream 6: `feature/frontend-detail-pages` - Complete Frontend Pages
**Priority:** High | **Complexity:** Medium | **Est. Files:** 8-10

**Tasks:**
1. Complete Job Detail Page `frontend/app/(dashboard)/jobs/[id]/page.tsx`
   - Full JD display with skills matrix editor
   - Edit/update functionality
   - Approval workflow buttons
   - Candidate tab with screening results

2. Complete Offer Detail Page `frontend/app/(dashboard)/offers/[id]/page.tsx`
   - Offer letter preview
   - Negotiation interface
   - Counter-offer form
   - Status timeline

3. Complete Phone Screen Detail `frontend/app/(dashboard)/phone-screens/[id]/page.tsx`
   - Call transcript viewer
   - Analysis results display
   - Audio playback if available

4. Complete Campaign Detail `frontend/app/(dashboard)/campaigns/[id]/page.tsx`
   - Message sequence editor
   - Recipient management
   - Performance analytics

5. Complete Sourcing Detail `frontend/app/(dashboard)/sourcing/[id]/page.tsx`
   - Candidate profile view
   - Fit score breakdown
   - Convert to application button

6. Implement global search functionality
   - Search service
   - Results dropdown
   - Cross-entity search

**Dependencies:** None (UI only)

---

### Stream 7: `feature/database-setup` - Database & Infrastructure
**Priority:** High | **Complexity:** Low | **Est. Files:** 4-5

**Tasks:**
1. Set up Supabase migrations
   - Create `supabase/migrations/` directory
   - Move 001_initial_schema.sql to migrations
   - Move 002_v2_schema.sql to migrations
   - Run migrations

2. Generate TypeScript types
   - `npm run db:types` or manual generation
   - Update frontend/types/supabase.ts

3. Add structured logging `backend/app/utils/logging.py`
   - JSON structured logs
   - Correlation IDs
   - Log levels configuration

4. Add rate limiting middleware
   - `backend/app/middleware/rate_limit.py`
   - Configure limits per endpoint

5. Update RLS policies for proper scoping
   - Review and tighten permissions

**Dependencies:** Supabase CLI

---

### Stream 8: `feature/testing-ci` - Testing & CI/CD
**Priority:** High | **Complexity:** Medium | **Est. Files:** 15-20

**Tasks:**
1. Set up pytest structure `backend/tests/`
   - `tests/conftest.py` - fixtures
   - `tests/unit/` - unit tests
   - `tests/integration/` - API tests

2. Write agent tests
   - `tests/unit/agents/test_jd_assist.py`
   - `tests/unit/agents/test_screener.py`
   - `tests/unit/agents/test_assessor.py`
   - `tests/unit/agents/test_offer_gen.py`

3. Write API endpoint tests
   - `tests/integration/test_jd_api.py`
   - `tests/integration/test_screening_api.py`
   - `tests/integration/test_assessment_api.py`
   - `tests/integration/test_offer_api.py`

4. Set up frontend testing
   - Jest configuration
   - Component tests
   - API mock tests

5. Create GitHub Actions CI/CD
   - `.github/workflows/ci.yml`
   - Run tests on PR
   - Deploy on merge to main

**Dependencies:** pytest, pytest-asyncio, jest

---

## Worktree Setup Commands

```bash
# Create worktrees directory
mkdir -p /Users/hadihijazi/TCS/HR-Plus-worktrees

# Create worktrees for each stream
git worktree add ../HR-Plus-worktrees/resume-parsing -b feature/resume-parsing
git worktree add ../HR-Plus-worktrees/video-analysis -b feature/video-analysis
git worktree add ../HR-Plus-worktrees/email-integration -b feature/email-integration
git worktree add ../HR-Plus-worktrees/candidate-sourcing -b feature/candidate-sourcing
git worktree add ../HR-Plus-worktrees/auth-middleware -b feature/auth-middleware
git worktree add ../HR-Plus-worktrees/frontend-detail-pages -b feature/frontend-detail-pages
git worktree add ../HR-Plus-worktrees/database-setup -b feature/database-setup
git worktree add ../HR-Plus-worktrees/testing-ci -b feature/testing-ci
```

---

## Execution Order

**Phase 1 (Critical - Parallel):**
- Stream 1: Resume Parsing
- Stream 2: Video Analysis
- Stream 3: Email Integration
- Stream 7: Database Setup

**Phase 2 (High Priority - After Phase 1 DB):**
- Stream 4: Candidate Sourcing
- Stream 5: Auth Middleware

**Phase 3 (After Phase 2):**
- Stream 6: Frontend Detail Pages
- Stream 8: Testing & CI/CD

---

## Merge Strategy

1. Database Setup merges first (foundation)
2. Resume Parsing, Video Analysis, Email merge in parallel
3. Auth Middleware merges next
4. Candidate Sourcing merges (depends on auth)
5. Frontend Detail Pages merge
6. Testing & CI/CD merges last

---

## Success Criteria

- [ ] All agents fully functional with real tool implementations
- [ ] All API endpoints complete with proper authentication
- [ ] All frontend pages fully implemented
- [ ] Database migrations tracked and applied
- [ ] Test coverage > 70%
- [ ] CI/CD pipeline operational
