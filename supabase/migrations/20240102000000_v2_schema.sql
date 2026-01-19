-- TalentAI V2 Schema - Sourcing, Outreach, Phone Screening, and Automation
-- Version: 2.0.0
-- Description: Adds multi-tenant support, candidate sourcing, email campaigns,
--              VAPI phone screening integration, candidate packets, scheduling,
--              and automation workflows.

-- ============================================
-- COMPANY & TEAM MANAGEMENT
-- ============================================

-- Companies: Multi-tenant organization support
-- All company-scoped data will reference this table for isolation
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE, -- Company email domain for auto-association
    logo_url VARCHAR(500),

    -- Subscription tier (affects feature access and limits)
    tier VARCHAR(50) DEFAULT 'self_serve', -- self_serve, growth, enterprise

    -- Company-wide settings (non-sensitive)
    -- Sensitive keys (API keys) should be in secrets manager, not here
    settings JSONB DEFAULT '{}'::jsonb,
    -- {default_timezone, email_from_name, phone_screen_enabled, etc.}

    -- Billing integration
    stripe_customer_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, past_due, cancelled

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update profiles to link to companies (from V1 schema)
-- This enables company-scoped RLS policies
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
    ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["read", "write"]'::jsonb;

-- ============================================
-- SOURCING & CANDIDATE DISCOVERY
-- ============================================

-- Sourced Candidates: Proactively discovered candidates (not yet applied)
-- Separate from candidates table to track outreach funnel separately
CREATE TABLE public.sourced_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) NOT NULL,
    job_id UUID REFERENCES public.jobs(id),

    -- Contact information
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),

    -- Source tracking for attribution
    source VARCHAR(50) NOT NULL, -- linkedin, github, referral, job_board, apollo, manual
    source_url VARCHAR(500), -- LinkedIn profile URL, GitHub URL, etc.
    source_data JSONB, -- Raw data from source platform

    -- Enriched profile data
    current_title VARCHAR(255),
    current_company VARCHAR(255),
    location VARCHAR(255),
    experience_years INTEGER,
    skills JSONB DEFAULT '[]'::jsonb,

    -- Profile summary
    headline VARCHAR(500),
    summary TEXT,
    profile_picture_url VARCHAR(500),

    -- AI-calculated job fit scoring
    fit_score DECIMAL(5,2), -- 0-100 scale
    fit_analysis JSONB, -- Detailed breakdown
    -- {skills_match: 85, experience_match: 70, location_match: 100, overall: 82, reasoning: "..."}

    -- Outreach funnel status
    status VARCHAR(50) DEFAULT 'new',
    -- new, contacted, responded, interested, not_interested,
    -- converted_to_candidate, bounced, unsubscribed

    -- Email verification status
    email_status VARCHAR(50), -- found, verified, bounced, unknown
    email_found_via VARCHAR(50), -- apollo, hunter, clearbit, manual

    -- Timestamps for funnel analytics
    sourced_at TIMESTAMPTZ DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate sourcing within same company
    UNIQUE(company_id, email)
);

-- ============================================
-- OUTREACH CAMPAIGNS
-- ============================================

-- Email Templates: Reusable email content with variable substitution
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id),

    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- outreach_initial, outreach_followup, interview_invite, rejection, offer

    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,

    -- Supported variables: {{first_name}}, {{company}}, {{job_title}}, {{sender_name}}, etc.
    variables JSONB DEFAULT '[]'::jsonb,

    -- Performance tracking
    times_used INTEGER DEFAULT 0,
    avg_open_rate DECIMAL(5,2),
    avg_reply_rate DECIMAL(5,2),

    is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns: Multi-step outreach sequences per job
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) NOT NULL,
    job_id UUID REFERENCES public.jobs(id) NOT NULL,

    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed

    -- Channel configuration
    channel VARCHAR(50) DEFAULT 'email', -- email, linkedin, multi

    -- Sequence definition: Array of steps with timing
    sequence JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{step: 1, day: 0, channel: "email", template_id: "...", subject_override: null, body_override: null}]
    -- [{step: 2, day: 3, channel: "email", template_id: "...", type: "follow_up"}]

    -- AI personalization settings
    personalization_level VARCHAR(50) DEFAULT 'high', -- none, basic, high
    ai_personalization_enabled BOOLEAN DEFAULT true,

    -- Send window to respect business hours
    send_window JSONB DEFAULT '{"start": "09:00", "end": "17:00", "timezone": "America/New_York"}'::jsonb,
    exclude_weekends BOOLEAN DEFAULT true,

    -- Aggregate statistics (updated by triggers)
    total_candidates INTEGER DEFAULT 0,
    total_contacted INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_interested INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,

    -- Campaign lifecycle
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Messages: Individual messages in campaign sequences
CREATE TABLE public.outreach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    sourced_candidate_id UUID REFERENCES public.sourced_candidates(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.email_templates(id),

    -- Message metadata
    channel VARCHAR(50) NOT NULL, -- email, linkedin
    sequence_step INTEGER NOT NULL, -- 1, 2, 3...

    -- Personalized content (final rendered version)
    subject VARCHAR(500),
    body TEXT NOT NULL,
    personalization_data JSONB, -- Variables used for personalization

    -- Email routing
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_email VARCHAR(255),
    reply_to VARCHAR(255),

    -- Email provider tracking
    provider VARCHAR(50), -- sendgrid, resend
    provider_message_id VARCHAR(255), -- For webhook correlation

    -- Delivery status lifecycle
    status VARCHAR(50) DEFAULT 'pending',
    -- pending, scheduled, sent, delivered, opened, clicked, replied, bounced, failed, cancelled

    -- Event timestamps for analytics
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    opened_count INTEGER DEFAULT 0,
    clicked_at TIMESTAMPTZ,
    clicked_count INTEGER DEFAULT 0,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,

    -- Reply analysis for automation
    reply_content TEXT,
    reply_sentiment VARCHAR(50), -- positive, negative, neutral, unknown
    reply_interest_level VARCHAR(50), -- high, medium, low, none
    ai_response_suggested TEXT,

    -- Error handling and retries
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHONE SCREENING (VAPI INTEGRATION)
-- ============================================

-- Phone Screens: AI-powered voice screening calls via VAPI
CREATE TABLE public.phone_screens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,

    -- VAPI integration identifiers
    vapi_call_id VARCHAR(255) UNIQUE,
    vapi_assistant_id VARCHAR(255),

    -- Call scheduling and routing
    phone_number VARCHAR(50),
    scheduled_at TIMESTAMPTZ,
    scheduled_by UUID REFERENCES public.profiles(id),

    -- Call execution tracking
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    ended_reason VARCHAR(100), -- completed, no_answer, busy, failed, cancelled

    -- Recording storage
    recording_url VARCHAR(500),
    recording_duration_seconds INTEGER,

    -- Transcript data
    transcript JSONB DEFAULT '[]'::jsonb,
    -- [{role: "assistant"|"user", content: "string", timestamp: "ISO", duration_ms: 1234}]
    transcript_text TEXT, -- Plain text for full-text search

    -- AI Analysis results
    analysis JSONB,
    -- {
    --   skills_discussed: [{skill, proficiency, evidence}],
    --   compensation_expectations: {min, max, currency, notes},
    --   availability: {start_date, notice_period, flexible, notes},
    --   experience_highlights: [],
    --   communication_score: 85,
    --   enthusiasm_score: 78,
    --   technical_depth_score: 72,
    --   red_flags: [],
    --   strengths: [],
    --   summary: "..."
    -- }

    -- Scoring and recommendation
    overall_score DECIMAL(5,2), -- 0-100
    recommendation VARCHAR(50), -- STRONG_YES, YES, MAYBE, NO
    confidence_level VARCHAR(20), -- high, medium, low

    -- Quick summary for list views
    summary JSONB,
    -- {
    --   key_takeaways: [],
    --   compensation_range: "$120k-140k",
    --   availability: "2 weeks notice",
    --   recommendation_reason: "Strong technical background..."
    -- }

    -- Questions and answers for review
    questions_asked JSONB DEFAULT '[]'::jsonb,
    -- [{question, answer, score, notes}]

    -- Status lifecycle
    status VARCHAR(50) DEFAULT 'scheduled',
    -- scheduled, calling, in_progress, completed, analyzed,
    -- cancelled, failed, no_answer, busy

    -- Retry handling for failed calls
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    retry_scheduled_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,

    -- Analysis completion
    analyzed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One phone screen per application
    UNIQUE(application_id)
);

-- ============================================
-- CANDIDATE PACKETS
-- ============================================

-- Candidate Packets: Deliverable summaries for hiring managers
CREATE TABLE public.candidate_packets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) NOT NULL,
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    -- Packet metadata
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, ready, delivered, reviewed

    -- Included applications
    application_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of application UUIDs

    -- Generated candidate summaries
    candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{
    --   application_id: "...",
    --   candidate_name: "...",
    --   current_role: "...",
    --   fit_score: 92,
    --   phone_screen_score: 88,
    --   summary: "...",
    --   strengths: [],
    --   concerns: [],
    --   compensation_expectation: "$130k-150k",
    --   availability: "2 weeks",
    --   suggested_questions: []
    -- }]

    -- AI-generated executive summary
    executive_summary TEXT,

    -- Comparison matrix for side-by-side evaluation
    comparison_matrix JSONB,
    -- {
    --   criteria: ["Technical Skills", "Communication", "Experience"],
    --   candidates: [{name, scores: [85, 90, 78]}]
    -- }

    -- Final ranking with reasoning
    ranking JSONB DEFAULT '[]'::jsonb, -- [{application_id, rank, reasoning}]

    -- Generated PDF document
    document_url VARCHAR(500), -- Storage path

    -- Delivery tracking
    delivered_to JSONB DEFAULT '[]'::jsonb, -- [{user_id, email, delivered_at}]
    delivered_at TIMESTAMPTZ,

    -- Hiring manager feedback
    feedback JSONB,
    -- {rating: 4, comments: "...", selected_candidates: [], rejected_candidates: []}
    feedback_at TIMESTAMPTZ,

    created_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEDULING (CAL.COM INTEGRATION)
-- ============================================

-- Interview Schedules: Calendar-integrated interview management
CREATE TABLE public.interview_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    -- Interview classification
    interview_type VARCHAR(50) NOT NULL, -- phone_screen, technical, behavioral, onsite, final, hiring_manager
    round_number INTEGER DEFAULT 1,
    title VARCHAR(255),

    -- Cal.com integration
    calcom_booking_id VARCHAR(255),
    calcom_event_type_id VARCHAR(255),
    calcom_uid VARCHAR(255),
    calcom_uri VARCHAR(500),

    -- Self-scheduling link for candidates
    scheduling_link VARCHAR(500),
    scheduling_link_expires_at TIMESTAMPTZ,

    -- Confirmed schedule details
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(50),

    -- Meeting location
    location_type VARCHAR(50), -- video, phone, in_person
    location_details VARCHAR(500), -- Zoom/Meet link, phone number, address
    meeting_url VARCHAR(500),

    -- Participants
    interviewer_ids JSONB DEFAULT '[]'::jsonb,
    interviewer_emails JSONB DEFAULT '[]'::jsonb,
    candidate_email VARCHAR(255),
    candidate_name VARCHAR(255),

    -- Status lifecycle
    status VARCHAR(50) DEFAULT 'pending',
    -- pending (link sent), scheduled, confirmed, completed, cancelled, rescheduled, no_show

    -- Interviewer feedback
    feedback JSONB,
    -- {
    --   overall_rating: 4,
    --   hire_recommendation: "yes",
    --   strengths: [],
    --   concerns: [],
    --   notes: "..."
    -- }
    feedback_submitted_at TIMESTAMPTZ,
    feedback_submitted_by UUID REFERENCES public.profiles(id),

    -- Reminder tracking
    reminder_sent_at TIMESTAMPTZ,
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_1h_sent BOOLEAN DEFAULT false,

    -- Cancellation tracking
    cancelled_at TIMESTAMPTZ,
    cancelled_by VARCHAR(50), -- candidate, recruiter, interviewer
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTOMATION & WORKFLOWS
-- ============================================

-- Automation Rules: Event-driven workflow triggers
CREATE TABLE public.automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Trigger definition
    trigger_type VARCHAR(50) NOT NULL,
    -- new_application, screening_complete, phone_screen_complete,
    -- assessment_complete, no_response_3d, no_response_7d,
    -- positive_reply, negative_reply, interview_scheduled, interview_complete

    -- Conditional execution
    trigger_conditions JSONB DEFAULT '{}'::jsonb,
    -- {job_ids: [], min_score: 70, recommendation: ["STRONG_YES", "YES"]}

    -- Action list (executed in order)
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [
    --   {action: "send_email", template_id: "..."},
    --   {action: "schedule_phone_screen", delay_hours: 24},
    --   {action: "add_to_campaign", campaign_id: "..."},
    --   {action: "notify_user", user_id: "...", message: "..."},
    --   {action: "update_status", status: "shortlisted"},
    --   {action: "reject", send_email: true, template_id: "..."}
    -- ]

    -- Rate limiting
    daily_limit INTEGER, -- Max executions per day
    total_limit INTEGER, -- Max total executions ever
    execution_count INTEGER DEFAULT 0,

    -- Active flag for easy enable/disable
    is_active BOOLEAN DEFAULT true,

    -- Usage statistics
    times_triggered INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,

    created_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Runs: Audit trail for automation execution
CREATE TABLE public.workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    -- Trigger context
    trigger_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- application, sourced_candidate, phone_screen
    entity_id UUID NOT NULL,

    -- Execution tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, skipped
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Action results
    actions_executed JSONB DEFAULT '[]'::jsonb,
    -- [{action: "send_email", status: "success", result: {...}}, ...]

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Companies: Domain lookup for auto-association
CREATE INDEX idx_companies_domain ON public.companies(domain);

-- Sourced Candidates: Common query patterns
CREATE INDEX idx_sourced_candidates_company ON public.sourced_candidates(company_id);
CREATE INDEX idx_sourced_candidates_job ON public.sourced_candidates(job_id);
CREATE INDEX idx_sourced_candidates_status ON public.sourced_candidates(status);
CREATE INDEX idx_sourced_candidates_email ON public.sourced_candidates(email);
CREATE INDEX idx_sourced_candidates_fit_score ON public.sourced_candidates(fit_score DESC);
CREATE INDEX idx_sourced_candidates_created ON public.sourced_candidates(created_at DESC);

-- Email Templates: Company and type filtering
CREATE INDEX idx_email_templates_company ON public.email_templates(company_id);
CREATE INDEX idx_email_templates_type ON public.email_templates(type);

-- Campaigns: Job and status filtering
CREATE INDEX idx_campaigns_company ON public.campaigns(company_id);
CREATE INDEX idx_campaigns_job ON public.campaigns(job_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);

-- Outreach Messages: Campaign views and scheduling
CREATE INDEX idx_outreach_messages_campaign ON public.outreach_messages(campaign_id);
CREATE INDEX idx_outreach_messages_candidate ON public.outreach_messages(sourced_candidate_id);
CREATE INDEX idx_outreach_messages_status ON public.outreach_messages(status);
CREATE INDEX idx_outreach_messages_scheduled ON public.outreach_messages(scheduled_at);
CREATE INDEX idx_outreach_messages_provider_id ON public.outreach_messages(provider_message_id);

-- Phone Screens: Application lookup and scheduling
CREATE INDEX idx_phone_screens_application ON public.phone_screens(application_id);
CREATE INDEX idx_phone_screens_status ON public.phone_screens(status);
CREATE INDEX idx_phone_screens_scheduled ON public.phone_screens(scheduled_at);
CREATE INDEX idx_phone_screens_vapi_call ON public.phone_screens(vapi_call_id);

-- Candidate Packets: Job and company filtering
CREATE INDEX idx_candidate_packets_job ON public.candidate_packets(job_id);
CREATE INDEX idx_candidate_packets_company ON public.candidate_packets(company_id);
CREATE INDEX idx_candidate_packets_status ON public.candidate_packets(status);

-- Interview Schedules: Scheduling queries
CREATE INDEX idx_interview_schedules_application ON public.interview_schedules(application_id);
CREATE INDEX idx_interview_schedules_company ON public.interview_schedules(company_id);
CREATE INDEX idx_interview_schedules_scheduled ON public.interview_schedules(scheduled_at);
CREATE INDEX idx_interview_schedules_status ON public.interview_schedules(status);
CREATE INDEX idx_interview_schedules_calcom ON public.interview_schedules(calcom_booking_id);

-- Automation Rules: Company and trigger filtering
CREATE INDEX idx_automation_rules_company ON public.automation_rules(company_id);
CREATE INDEX idx_automation_rules_trigger ON public.automation_rules(trigger_type);
CREATE INDEX idx_automation_rules_active ON public.automation_rules(is_active);

-- Workflow Runs: Audit queries
CREATE INDEX idx_workflow_runs_rule ON public.workflow_runs(automation_rule_id);
CREATE INDEX idx_workflow_runs_company ON public.workflow_runs(company_id);
CREATE INDEX idx_workflow_runs_entity ON public.workflow_runs(entity_type, entity_id);
CREATE INDEX idx_workflow_runs_created ON public.workflow_runs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
--
-- V2 Security Model:
-- Multi-tenant isolation via company_id. Users can only access data
-- belonging to their company. This is enforced via subquery checking
-- the user's company_id from their profile.
--
-- Helper pattern used in policies:
-- company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
--
-- service_role: Full access for backend operations (webhooks, background jobs)
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourced_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COMPANIES POLICIES
-- ============================================
-- Users can only view their own company. Company creation/updates
-- are handled by service_role (admin operations).

CREATE POLICY "companies_select_own"
    ON public.companies FOR SELECT
    TO authenticated
    USING (id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
-- Users can only see the company they belong to.
-- This prevents cross-tenant data access.

CREATE POLICY "companies_all_service"
    ON public.companies FOR ALL
    TO service_role
    USING (true);
-- Backend services have full access for admin operations.

-- ============================================
-- SOURCED CANDIDATES POLICIES
-- ============================================
-- Strictly company-scoped. Users can only manage candidates sourced
-- by their company.

CREATE POLICY "sourced_candidates_company_scoped"
    ON public.sourced_candidates FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
-- Full CRUD for users within the same company.

CREATE POLICY "sourced_candidates_all_service"
    ON public.sourced_candidates FOR ALL
    TO service_role
    USING (true);
-- Backend services need access for enrichment jobs, imports, etc.

-- ============================================
-- EMAIL TEMPLATES POLICIES
-- ============================================
-- Company-scoped with special handling for system templates.
-- System templates (is_system = true) are shared across all companies.

CREATE POLICY "email_templates_company_scoped"
    ON public.email_templates FOR ALL
    TO authenticated
    USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR is_system = true
    );
-- Users can manage their company's templates and view system templates.
-- System templates cannot be modified by users (enforced in application layer).

CREATE POLICY "email_templates_all_service"
    ON public.email_templates FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- CAMPAIGNS POLICIES
-- ============================================
-- Strictly company-scoped. Campaigns are tied to jobs within the company.

CREATE POLICY "campaigns_company_scoped"
    ON public.campaigns FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "campaigns_all_service"
    ON public.campaigns FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- OUTREACH MESSAGES POLICIES
-- ============================================
-- Access controlled via parent campaign's company_id.
-- This ensures messages inherit the company scope of their campaign.

CREATE POLICY "outreach_messages_via_campaign"
    ON public.outreach_messages FOR ALL
    TO authenticated
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
    );
-- Users can only access messages from campaigns belonging to their company.

CREATE POLICY "outreach_messages_all_service"
    ON public.outreach_messages FOR ALL
    TO service_role
    USING (true);
-- Backend needs access for email sending, webhook processing, etc.

-- ============================================
-- PHONE SCREENS POLICIES
-- ============================================
-- Phone screens are accessed by authenticated users.
-- NOTE: These policies are more permissive than other V2 tables because
-- phone screens link to applications (V1) which don't have company_id.
-- Consider adding company_id to phone_screens for stricter isolation.

CREATE POLICY "phone_screens_select_authenticated"
    ON public.phone_screens FOR SELECT
    TO authenticated
    USING (true);
-- CONSIDERATION: Add company-scoping when applications table has company_id:
-- USING (application_id IN (SELECT id FROM applications WHERE company_id = ...))

CREATE POLICY "phone_screens_insert_authenticated"
    ON public.phone_screens FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "phone_screens_update_authenticated"
    ON public.phone_screens FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "phone_screens_all_service"
    ON public.phone_screens FOR ALL
    TO service_role
    USING (true);
-- Backend needs full access for VAPI webhook handling.

-- ============================================
-- CANDIDATE PACKETS POLICIES
-- ============================================
-- Strictly company-scoped. Packets contain sensitive candidate evaluations.

CREATE POLICY "candidate_packets_company_scoped"
    ON public.candidate_packets FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "candidate_packets_all_service"
    ON public.candidate_packets FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- INTERVIEW SCHEDULES POLICIES
-- ============================================
-- Strictly company-scoped. Interview schedules contain hiring details.

CREATE POLICY "interview_schedules_company_scoped"
    ON public.interview_schedules FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "interview_schedules_all_service"
    ON public.interview_schedules FOR ALL
    TO service_role
    USING (true);
-- Backend needs access for Cal.com webhook handling.

-- ============================================
-- AUTOMATION RULES POLICIES
-- ============================================
-- Strictly company-scoped. Automation rules are company configuration.

CREATE POLICY "automation_rules_company_scoped"
    ON public.automation_rules FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "automation_rules_all_service"
    ON public.automation_rules FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- WORKFLOW RUNS POLICIES
-- ============================================
-- Strictly company-scoped. Workflow runs are audit logs for automation.

CREATE POLICY "workflow_runs_company_scoped"
    ON public.workflow_runs FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "workflow_runs_all_service"
    ON public.workflow_runs FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to all new tables
CREATE TRIGGER set_updated_at_companies
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_sourced_candidates
    BEFORE UPDATE ON public.sourced_candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_email_templates
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_campaigns
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_outreach_messages
    BEFORE UPDATE ON public.outreach_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_phone_screens
    BEFORE UPDATE ON public.phone_screens
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_candidate_packets
    BEFORE UPDATE ON public.candidate_packets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_interview_schedules
    BEFORE UPDATE ON public.interview_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_automation_rules
    BEFORE UPDATE ON public.automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Generate placeholder VAPI call ID for new phone screens
CREATE OR REPLACE FUNCTION public.generate_phone_screen_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vapi_call_id IS NULL THEN
        NEW.vapi_call_id = 'pending_' || encode(gen_random_bytes(16), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update campaign aggregate statistics
-- Triggered after each outreach message insert/update
CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.campaigns
    SET
        total_contacted = (SELECT COUNT(*) FROM public.outreach_messages WHERE campaign_id = NEW.campaign_id AND status != 'pending'),
        total_opened = (SELECT COUNT(*) FROM public.outreach_messages WHERE campaign_id = NEW.campaign_id AND opened_at IS NOT NULL),
        total_clicked = (SELECT COUNT(*) FROM public.outreach_messages WHERE campaign_id = NEW.campaign_id AND clicked_at IS NOT NULL),
        total_replied = (SELECT COUNT(*) FROM public.outreach_messages WHERE campaign_id = NEW.campaign_id AND replied_at IS NOT NULL),
        total_bounced = (SELECT COUNT(*) FROM public.outreach_messages WHERE campaign_id = NEW.campaign_id AND status = 'bounced')
    WHERE id = NEW.campaign_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_stats_on_message
    AFTER INSERT OR UPDATE ON public.outreach_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_campaign_stats();

-- ============================================
-- SEED DATA: System Email Templates
-- ============================================
-- These templates are available to all companies (is_system = true)

INSERT INTO public.email_templates (name, type, subject, body, variables, is_system) VALUES
(
    'Initial Outreach - Engineering',
    'outreach_initial',
    'Quick question about {{job_title}} at {{company_name}}',
    E'Hi {{first_name}},\n\nI came across your profile and was impressed by your work at {{current_company}}. We''re building something exciting at {{company_name}} and looking for a {{job_title}} to join the team.\n\nWould you be open to a quick 15-minute call to learn more?\n\nBest,\n{{sender_name}}',
    '["first_name", "job_title", "company_name", "current_company", "sender_name"]',
    true
),
(
    'Follow-up - Day 3',
    'outreach_followup',
    'Following up: {{job_title}} opportunity',
    E'Hi {{first_name}},\n\nJust wanted to follow up on my previous note about the {{job_title}} role at {{company_name}}.\n\nI''d love to share more about what we''re working on. Are you free for a brief chat this week?\n\nBest,\n{{sender_name}}',
    '["first_name", "job_title", "company_name", "sender_name"]',
    true
),
(
    'Interview Invitation',
    'interview_invite',
    'Interview invitation: {{job_title}} at {{company_name}}',
    E'Hi {{first_name}},\n\nGreat news! We''d love to move forward with an interview for the {{job_title}} position.\n\nPlease use the link below to schedule a time that works for you:\n{{scheduling_link}}\n\nLooking forward to speaking with you!\n\nBest,\n{{sender_name}}',
    '["first_name", "job_title", "company_name", "scheduling_link", "sender_name"]',
    true
),
(
    'Application Rejection',
    'rejection',
    'Update on your application to {{company_name}}',
    E'Hi {{first_name}},\n\nThank you for your interest in the {{job_title}} role at {{company_name}} and for taking the time to apply.\n\nAfter careful consideration, we''ve decided to move forward with other candidates whose experience more closely matches our current needs.\n\nWe appreciate your interest and wish you the best in your job search.\n\nBest regards,\n{{company_name}} Recruiting Team',
    '["first_name", "job_title", "company_name"]',
    true
);
