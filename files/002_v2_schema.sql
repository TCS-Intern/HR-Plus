-- TalentAI V2: Full-Stack AI Recruiting Company
-- Migration to add sourcing, outreach, phone screening, and automation

-- ============================================
-- COMPANY & TEAM MANAGEMENT
-- ============================================

-- Companies (for multi-tenant support)
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    logo_url VARCHAR(500),

    -- Tier
    tier VARCHAR(50) DEFAULT 'self_serve', -- self_serve, growth, enterprise

    -- Settings (API keys stored encrypted or in secrets manager)
    settings JSONB DEFAULT '{}'::jsonb,
    -- {default_timezone, email_from_name, phone_screen_enabled, etc.}

    -- Billing
    stripe_customer_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, past_due, cancelled

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update profiles to link to companies
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
    ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["read", "write"]'::jsonb;

-- ============================================
-- SOURCING & CANDIDATE DISCOVERY
-- ============================================

-- Sourced Candidates (candidates found proactively, not applied)
CREATE TABLE public.sourced_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) NOT NULL,
    job_id UUID REFERENCES public.jobs(id),

    -- Basic info
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),

    -- Source details
    source VARCHAR(50) NOT NULL, -- linkedin, github, referral, job_board, apollo, manual
    source_url VARCHAR(500), -- LinkedIn profile URL, GitHub URL, etc.
    source_data JSONB, -- Raw data from source

    -- Enriched data
    current_title VARCHAR(255),
    current_company VARCHAR(255),
    location VARCHAR(255),
    experience_years INTEGER,
    skills JSONB DEFAULT '[]'::jsonb,

    -- Profile data
    headline VARCHAR(500),
    summary TEXT,
    profile_picture_url VARCHAR(500),

    -- Scoring
    fit_score DECIMAL(5,2), -- AI-calculated job fit (0-100)
    fit_analysis JSONB, -- Detailed fit breakdown
    -- {skills_match: 85, experience_match: 70, location_match: 100, overall: 82, reasoning: "..."}

    -- Status
    status VARCHAR(50) DEFAULT 'new',
    -- new, contacted, responded, interested, not_interested,
    -- converted_to_candidate, bounced, unsubscribed

    -- Email finding
    email_status VARCHAR(50), -- found, verified, bounced, unknown
    email_found_via VARCHAR(50), -- apollo, hunter, clearbit, manual

    -- Timestamps
    sourced_at TIMESTAMPTZ DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, email)
);

-- ============================================
-- OUTREACH CAMPAIGNS
-- ============================================

-- Email Templates
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id),

    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- outreach_initial, outreach_followup, interview_invite, rejection, offer

    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,

    -- Variables: {{first_name}}, {{company}}, {{job_title}}, {{sender_name}}, etc.
    variables JSONB DEFAULT '[]'::jsonb,

    -- Stats
    times_used INTEGER DEFAULT 0,
    avg_open_rate DECIMAL(5,2),
    avg_reply_rate DECIMAL(5,2),

    is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns (outreach sequences per job)
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) NOT NULL,
    job_id UUID REFERENCES public.jobs(id) NOT NULL,

    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed

    -- Campaign settings
    channel VARCHAR(50) DEFAULT 'email', -- email, linkedin, multi

    -- Sequence definition
    sequence JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{step: 1, day: 0, channel: "email", template_id: "...", subject_override: null, body_override: null}]
    -- [{step: 2, day: 3, channel: "email", template_id: "...", type: "follow_up"}]

    -- Personalization
    personalization_level VARCHAR(50) DEFAULT 'high', -- none, basic, high
    ai_personalization_enabled BOOLEAN DEFAULT true,

    -- Timing
    send_window JSONB DEFAULT '{"start": "09:00", "end": "17:00", "timezone": "America/New_York"}'::jsonb,
    exclude_weekends BOOLEAN DEFAULT true,

    -- Stats (updated via triggers or background jobs)
    total_candidates INTEGER DEFAULT 0,
    total_contacted INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_interested INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Messages (individual messages sent)
CREATE TABLE public.outreach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    sourced_candidate_id UUID REFERENCES public.sourced_candidates(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.email_templates(id),

    -- Message details
    channel VARCHAR(50) NOT NULL, -- email, linkedin
    sequence_step INTEGER NOT NULL, -- 1, 2, 3...

    -- Content (personalized final version)
    subject VARCHAR(500),
    body TEXT NOT NULL,
    personalization_data JSONB, -- Data used for personalization

    -- Email specifics
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_email VARCHAR(255),
    reply_to VARCHAR(255),

    -- Provider tracking
    provider VARCHAR(50), -- sendgrid, resend
    provider_message_id VARCHAR(255), -- Email provider message ID

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending',
    -- pending, scheduled, sent, delivered, opened, clicked, replied, bounced, failed, cancelled

    -- Event timestamps
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    opened_count INTEGER DEFAULT 0,
    clicked_at TIMESTAMPTZ,
    clicked_count INTEGER DEFAULT 0,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,

    -- Reply handling
    reply_content TEXT,
    reply_sentiment VARCHAR(50), -- positive, negative, neutral, unknown
    reply_interest_level VARCHAR(50), -- high, medium, low, none
    ai_response_suggested TEXT,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHONE SCREENING (VAPI INTEGRATION)
-- ============================================

-- Phone Screens
CREATE TABLE public.phone_screens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,

    -- Vapi call details
    vapi_call_id VARCHAR(255) UNIQUE,
    vapi_assistant_id VARCHAR(255),

    -- Call info
    phone_number VARCHAR(50),
    scheduled_at TIMESTAMPTZ,
    scheduled_by UUID REFERENCES public.profiles(id),

    -- Call execution
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    ended_reason VARCHAR(100), -- completed, no_answer, busy, failed, cancelled

    -- Recording
    recording_url VARCHAR(500),
    recording_duration_seconds INTEGER,

    -- Transcript
    transcript JSONB DEFAULT '[]'::jsonb,
    -- [{role: "assistant"|"user", content: "string", timestamp: "ISO", duration_ms: 1234}]
    transcript_text TEXT, -- Plain text version for search

    -- AI Analysis
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

    -- Scores
    overall_score DECIMAL(5,2), -- 0-100
    recommendation VARCHAR(50), -- STRONG_YES, YES, MAYBE, NO
    confidence_level VARCHAR(20), -- high, medium, low

    -- Summary for quick display
    summary JSONB,
    -- {
    --   key_takeaways: [],
    --   compensation_range: "$120k-140k",
    --   availability: "2 weeks notice",
    --   recommendation_reason: "Strong technical background..."
    -- }

    -- Questions asked (for review)
    questions_asked JSONB DEFAULT '[]'::jsonb,
    -- [{question, answer, score, notes}]

    -- Status
    status VARCHAR(50) DEFAULT 'scheduled',
    -- scheduled, calling, in_progress, completed, analyzed,
    -- cancelled, failed, no_answer, busy

    -- Retry handling
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    retry_scheduled_at TIMESTAMPTZ,

    -- Error handling
    error_message TEXT,

    -- Analysis timestamps
    analyzed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(application_id)
);

-- ============================================
-- CANDIDATE PACKETS
-- ============================================

-- Candidate Packets (deliverable to hiring manager)
CREATE TABLE public.candidate_packets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) NOT NULL,
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    -- Packet info
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, ready, delivered, reviewed

    -- Candidates included
    application_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of application UUIDs

    -- Generated content
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

    -- Executive summary
    executive_summary TEXT,

    -- Comparison matrix
    comparison_matrix JSONB,
    -- {
    --   criteria: ["Technical Skills", "Communication", "Experience"],
    --   candidates: [{name, scores: [85, 90, 78]}]
    -- }

    -- Ranking
    ranking JSONB DEFAULT '[]'::jsonb, -- [{application_id, rank, reasoning}]

    -- Document
    document_url VARCHAR(500), -- Generated PDF in storage

    -- Delivery
    delivered_to JSONB DEFAULT '[]'::jsonb, -- Array of {user_id, email, delivered_at}
    delivered_at TIMESTAMPTZ,

    -- Feedback from hiring manager
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

-- Interview Schedules
CREATE TABLE public.interview_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    -- Interview type
    interview_type VARCHAR(50) NOT NULL, -- phone_screen, technical, behavioral, onsite, final, hiring_manager
    round_number INTEGER DEFAULT 1,
    title VARCHAR(255),

    -- Cal.com integration
    calcom_booking_id VARCHAR(255),
    calcom_event_type_id VARCHAR(255),
    calcom_uid VARCHAR(255),
    calcom_uri VARCHAR(500),

    -- Scheduling link (for candidate)
    scheduling_link VARCHAR(500),
    scheduling_link_expires_at TIMESTAMPTZ,

    -- Scheduled details
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(50),

    -- Location
    location_type VARCHAR(50), -- video, phone, in_person
    location_details VARCHAR(500), -- Zoom/Meet link, phone number, address
    meeting_url VARCHAR(500),

    -- Participants
    interviewer_ids JSONB DEFAULT '[]'::jsonb,
    interviewer_emails JSONB DEFAULT '[]'::jsonb,
    candidate_email VARCHAR(255),
    candidate_name VARCHAR(255),

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    -- pending (link sent), scheduled, confirmed, completed, cancelled, rescheduled, no_show

    -- Feedback
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

    -- Reminders
    reminder_sent_at TIMESTAMPTZ,
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_1h_sent BOOLEAN DEFAULT false,

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancelled_by VARCHAR(50), -- candidate, recruiter, interviewer
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTOMATION & WORKFLOWS
-- ============================================

-- Automation Rules
CREATE TABLE public.automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Trigger
    trigger_type VARCHAR(50) NOT NULL,
    -- new_application, screening_complete, phone_screen_complete,
    -- assessment_complete, no_response_3d, no_response_7d,
    -- positive_reply, negative_reply, interview_scheduled, interview_complete

    trigger_conditions JSONB DEFAULT '{}'::jsonb,
    -- {job_ids: [], min_score: 70, recommendation: ["STRONG_YES", "YES"]}

    -- Actions
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [
    --   {action: "send_email", template_id: "..."},
    --   {action: "schedule_phone_screen", delay_hours: 24},
    --   {action: "add_to_campaign", campaign_id: "..."},
    --   {action: "notify_user", user_id: "...", message: "..."},
    --   {action: "update_status", status: "shortlisted"},
    --   {action: "reject", send_email: true, template_id: "..."}
    -- ]

    -- Limits
    daily_limit INTEGER, -- Max executions per day
    total_limit INTEGER, -- Max total executions
    execution_count INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Stats
    times_triggered INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,

    created_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Runs (audit trail for automation)
CREATE TABLE public.workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) NOT NULL,

    -- Trigger context
    trigger_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- application, sourced_candidate, phone_screen
    entity_id UUID NOT NULL,

    -- Execution
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, skipped
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    actions_executed JSONB DEFAULT '[]'::jsonb,
    -- [{action: "send_email", status: "success", result: {...}}, ...]

    -- Errors
    error_message TEXT,
    error_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Companies
CREATE INDEX idx_companies_domain ON public.companies(domain);

-- Sourced Candidates
CREATE INDEX idx_sourced_candidates_company ON public.sourced_candidates(company_id);
CREATE INDEX idx_sourced_candidates_job ON public.sourced_candidates(job_id);
CREATE INDEX idx_sourced_candidates_status ON public.sourced_candidates(status);
CREATE INDEX idx_sourced_candidates_email ON public.sourced_candidates(email);
CREATE INDEX idx_sourced_candidates_fit_score ON public.sourced_candidates(fit_score DESC);
CREATE INDEX idx_sourced_candidates_created ON public.sourced_candidates(created_at DESC);

-- Email Templates
CREATE INDEX idx_email_templates_company ON public.email_templates(company_id);
CREATE INDEX idx_email_templates_type ON public.email_templates(type);

-- Campaigns
CREATE INDEX idx_campaigns_company ON public.campaigns(company_id);
CREATE INDEX idx_campaigns_job ON public.campaigns(job_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);

-- Outreach Messages
CREATE INDEX idx_outreach_messages_campaign ON public.outreach_messages(campaign_id);
CREATE INDEX idx_outreach_messages_candidate ON public.outreach_messages(sourced_candidate_id);
CREATE INDEX idx_outreach_messages_status ON public.outreach_messages(status);
CREATE INDEX idx_outreach_messages_scheduled ON public.outreach_messages(scheduled_at);
CREATE INDEX idx_outreach_messages_provider_id ON public.outreach_messages(provider_message_id);

-- Phone Screens
CREATE INDEX idx_phone_screens_application ON public.phone_screens(application_id);
CREATE INDEX idx_phone_screens_status ON public.phone_screens(status);
CREATE INDEX idx_phone_screens_scheduled ON public.phone_screens(scheduled_at);
CREATE INDEX idx_phone_screens_vapi_call ON public.phone_screens(vapi_call_id);

-- Candidate Packets
CREATE INDEX idx_candidate_packets_job ON public.candidate_packets(job_id);
CREATE INDEX idx_candidate_packets_company ON public.candidate_packets(company_id);
CREATE INDEX idx_candidate_packets_status ON public.candidate_packets(status);

-- Interview Schedules
CREATE INDEX idx_interview_schedules_application ON public.interview_schedules(application_id);
CREATE INDEX idx_interview_schedules_company ON public.interview_schedules(company_id);
CREATE INDEX idx_interview_schedules_scheduled ON public.interview_schedules(scheduled_at);
CREATE INDEX idx_interview_schedules_status ON public.interview_schedules(status);
CREATE INDEX idx_interview_schedules_calcom ON public.interview_schedules(calcom_booking_id);

-- Automation Rules
CREATE INDEX idx_automation_rules_company ON public.automation_rules(company_id);
CREATE INDEX idx_automation_rules_trigger ON public.automation_rules(trigger_type);
CREATE INDEX idx_automation_rules_active ON public.automation_rules(is_active);

-- Workflow Runs
CREATE INDEX idx_workflow_runs_rule ON public.workflow_runs(automation_rule_id);
CREATE INDEX idx_workflow_runs_company ON public.workflow_runs(company_id);
CREATE INDEX idx_workflow_runs_entity ON public.workflow_runs(entity_type, entity_id);
CREATE INDEX idx_workflow_runs_created ON public.workflow_runs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
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

-- Companies: Users can only see their own company
CREATE POLICY "Users can view own company"
    ON public.companies FOR SELECT
    TO authenticated
    USING (id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to companies"
    ON public.companies FOR ALL
    TO service_role
    USING (true);

-- Sourced Candidates: Company-scoped
CREATE POLICY "Sourced candidates are company-scoped"
    ON public.sourced_candidates FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to sourced_candidates"
    ON public.sourced_candidates FOR ALL
    TO service_role
    USING (true);

-- Email Templates: Company-scoped + system templates
CREATE POLICY "Email templates are company-scoped"
    ON public.email_templates FOR ALL
    TO authenticated
    USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR is_system = true
    );

CREATE POLICY "Service role full access to email_templates"
    ON public.email_templates FOR ALL
    TO service_role
    USING (true);

-- Campaigns: Company-scoped
CREATE POLICY "Campaigns are company-scoped"
    ON public.campaigns FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to campaigns"
    ON public.campaigns FOR ALL
    TO service_role
    USING (true);

-- Outreach Messages: Via campaign company
CREATE POLICY "Outreach messages via campaign"
    ON public.outreach_messages FOR ALL
    TO authenticated
    USING (
        campaign_id IN (
            SELECT id FROM public.campaigns
            WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Service role full access to outreach_messages"
    ON public.outreach_messages FOR ALL
    TO service_role
    USING (true);

-- Phone Screens: Authenticated users can manage
CREATE POLICY "Phone screens viewable by authenticated"
    ON public.phone_screens FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Phone screens manageable by authenticated"
    ON public.phone_screens FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Phone screens updatable by authenticated"
    ON public.phone_screens FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Service role full access to phone_screens"
    ON public.phone_screens FOR ALL
    TO service_role
    USING (true);

-- Candidate Packets: Company-scoped
CREATE POLICY "Candidate packets are company-scoped"
    ON public.candidate_packets FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to candidate_packets"
    ON public.candidate_packets FOR ALL
    TO service_role
    USING (true);

-- Interview Schedules: Company-scoped
CREATE POLICY "Interview schedules are company-scoped"
    ON public.interview_schedules FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to interview_schedules"
    ON public.interview_schedules FOR ALL
    TO service_role
    USING (true);

-- Automation Rules: Company-scoped
CREATE POLICY "Automation rules are company-scoped"
    ON public.automation_rules FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to automation_rules"
    ON public.automation_rules FOR ALL
    TO service_role
    USING (true);

-- Workflow Runs: Company-scoped
CREATE POLICY "Workflow runs are company-scoped"
    ON public.workflow_runs FOR ALL
    TO authenticated
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access to workflow_runs"
    ON public.workflow_runs FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to new tables
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

-- Function to generate phone screen access token
CREATE OR REPLACE FUNCTION public.generate_phone_screen_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vapi_call_id IS NULL THEN
        NEW.vapi_call_id = 'pending_' || encode(gen_random_bytes(16), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update campaign stats
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
