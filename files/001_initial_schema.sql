-- TalentAI Database Schema
-- Run this in Supabase SQL Editor or as a migration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'recruiter', -- admin, hiring_manager, recruiter, interviewer
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    location VARCHAR(255),
    job_type VARCHAR(50) DEFAULT 'full-time', -- full-time, part-time, contract, internship
    remote_policy VARCHAR(50) DEFAULT 'hybrid', -- remote, hybrid, onsite
    summary TEXT,
    description TEXT,
    responsibilities JSONB DEFAULT '[]'::jsonb,
    qualifications JSONB DEFAULT '{"required": [], "preferred": []}'::jsonb,
    skills_matrix JSONB DEFAULT '{"required": [], "nice_to_have": []}'::jsonb,
    evaluation_criteria JSONB DEFAULT '[]'::jsonb,
    suggested_questions JSONB DEFAULT '{"technical": [], "behavioral": [], "situational": []}'::jsonb,
    salary_range JSONB DEFAULT '{"min": null, "max": null, "currency": "USD"}'::jsonb,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, closed, filled
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates
CREATE TABLE public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    linkedin_data JSONB, -- cached LinkedIn profile data
    resume_url VARCHAR(500), -- Supabase Storage path
    resume_parsed JSONB, -- extracted/structured resume data
    source VARCHAR(50) DEFAULT 'direct', -- linkedin, referral, direct, job_board
    source_details VARCHAR(255), -- specific job board, referrer name, etc.
    tags JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications (Job-Candidate junction)
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'new', -- new, screening, shortlisted, assessment, offer, hired, rejected, withdrawn
    
    -- Screening results
    screening_score DECIMAL(5,2),
    screening_recommendation VARCHAR(50), -- strong_match, good_match, partial_match, weak_match
    screening_notes JSONB,
    match_breakdown JSONB, -- detailed skill matches
    strengths JSONB DEFAULT '[]'::jsonb,
    gaps JSONB DEFAULT '[]'::jsonb,
    red_flags JSONB DEFAULT '[]'::jsonb,
    
    -- Tracking
    current_stage VARCHAR(50) DEFAULT 'new',
    stage_history JSONB DEFAULT '[]'::jsonb, -- [{stage, timestamp, actor}]
    
    -- Timestamps
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    screened_at TIMESTAMPTZ,
    shortlisted_at TIMESTAMPTZ,
    assessed_at TIMESTAMPTZ,
    offered_at TIMESTAMPTZ,
    hired_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(job_id, candidate_id)
);

-- Assessments
CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) DEFAULT 'video', -- video, technical, take_home
    
    -- Questions
    questions JSONB DEFAULT '[]'::jsonb,
    -- [{question_id, question_type, question_text, time_limit, rubric, key_topics}]
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    scheduled_duration_minutes INTEGER DEFAULT 30,
    calendar_event_id VARCHAR(255),
    
    -- Video data
    video_url VARCHAR(500), -- Supabase Storage path
    video_duration_seconds INTEGER,
    
    -- Analysis results
    video_analysis JSONB,
    -- {response_analysis: [], communication_assessment: {}, behavioral_assessment: {}}
    
    response_scores JSONB DEFAULT '[]'::jsonb,
    overall_score DECIMAL(5,2),
    recommendation VARCHAR(50), -- STRONG_YES, YES, MAYBE, NO
    confidence_level VARCHAR(20), -- high, medium, low
    
    -- Summary
    summary JSONB,
    -- {top_strengths: [], areas_of_concern: [], hiring_recommendation: ""}
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, analyzed, expired
    completed_at TIMESTAMPTZ,
    analyzed_at TIMESTAMPTZ,
    
    -- Config
    behavioral_analysis_enabled BOOLEAN DEFAULT true,
    
    -- Access token for candidate
    access_token VARCHAR(255) UNIQUE,
    token_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers
CREATE TABLE public.offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    
    -- Compensation
    base_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    signing_bonus DECIMAL(12,2) DEFAULT 0,
    annual_bonus_target DECIMAL(5,2), -- percentage
    
    -- Equity
    equity_type VARCHAR(50), -- options, rsu, none
    equity_amount DECIMAL(10,4), -- shares or percentage
    equity_vesting_schedule VARCHAR(100), -- "4 years with 1 year cliff"
    
    -- Benefits
    benefits JSONB DEFAULT '[]'::jsonb,
    -- [{benefit_type, description, value_estimate}]
    
    -- Dates
    start_date DATE,
    offer_expiry_date DATE,
    
    -- Documents
    offer_letter_url VARCHAR(500),
    contract_url VARCHAR(500),
    
    -- Contingencies
    contingencies JSONB DEFAULT '[]'::jsonb, -- ["background_check", "reference_check"]
    
    -- Negotiation
    negotiation_notes JSONB DEFAULT '[]'::jsonb,
    negotiation_guidance JSONB, -- {salary_flexibility: {min, max}, other_levers: []}
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, sent, viewed, accepted, rejected, negotiating, expired
    
    -- Approvals
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    
    -- Timestamps
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    response_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Activity Logs
CREATE TABLE public.agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50) NOT NULL, -- jd_assist, screener, assessor, offer_gen
    action VARCHAR(100) NOT NULL, -- generate_jd, screen_candidates, analyze_video, etc.
    
    -- Related entities
    entity_type VARCHAR(50), -- job, candidate, application, assessment, offer
    entity_id UUID,
    
    -- Input/Output
    input_data JSONB,
    output_data JSONB,
    
    -- Performance metrics
    tokens_used INTEGER,
    latency_ms INTEGER,
    model_used VARCHAR(50),
    
    -- Status
    status VARCHAR(50) DEFAULT 'success', -- success, error, partial
    error_message TEXT,
    error_details JSONB,
    
    -- Actor
    triggered_by UUID REFERENCES public.profiles(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Jobs
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_by ON public.jobs(created_by);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);

-- Candidates
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_candidates_created_at ON public.candidates(created_at DESC);

-- Applications
CREATE INDEX idx_applications_job_id ON public.applications(job_id);
CREATE INDEX idx_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_screening_score ON public.applications(screening_score DESC);

-- Assessments
CREATE INDEX idx_assessments_application_id ON public.assessments(application_id);
CREATE INDEX idx_assessments_status ON public.assessments(status);
CREATE INDEX idx_assessments_access_token ON public.assessments(access_token);

-- Offers
CREATE INDEX idx_offers_application_id ON public.offers(application_id);
CREATE INDEX idx_offers_status ON public.offers(status);

-- Agent logs
CREATE INDEX idx_agent_logs_agent_type ON public.agent_logs(agent_type);
CREATE INDEX idx_agent_logs_entity ON public.agent_logs(entity_type, entity_id);
CREATE INDEX idx_agent_logs_created_at ON public.agent_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Jobs: All authenticated users can view and manage jobs
CREATE POLICY "Jobs are viewable by authenticated users"
    ON public.jobs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create jobs"
    ON public.jobs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
    ON public.jobs FOR UPDATE
    TO authenticated
    USING (true);

-- Candidates: All authenticated users can view and manage candidates
CREATE POLICY "Candidates are viewable by authenticated users"
    ON public.candidates FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create candidates"
    ON public.candidates FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidates"
    ON public.candidates FOR UPDATE
    TO authenticated
    USING (true);

-- Applications: All authenticated users can manage applications
CREATE POLICY "Applications are viewable by authenticated users"
    ON public.applications FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create applications"
    ON public.applications FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update applications"
    ON public.applications FOR UPDATE
    TO authenticated
    USING (true);

-- Assessments: Authenticated users can manage, candidates can view their own via token
CREATE POLICY "Assessments are viewable by authenticated users"
    ON public.assessments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create assessments"
    ON public.assessments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update assessments"
    ON public.assessments FOR UPDATE
    TO authenticated
    USING (true);

-- Offers: All authenticated users can manage offers
CREATE POLICY "Offers are viewable by authenticated users"
    ON public.offers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create offers"
    ON public.offers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update offers"
    ON public.offers FOR UPDATE
    TO authenticated
    USING (true);

-- Agent logs: All authenticated users can view, system can insert
CREATE POLICY "Agent logs are viewable by authenticated users"
    ON public.agent_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can insert agent logs"
    ON public.agent_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_jobs
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_candidates
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_applications
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_assessments
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_offers
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to generate assessment access token
CREATE OR REPLACE FUNCTION public.generate_assessment_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.access_token IS NULL THEN
        NEW.access_token = encode(gen_random_bytes(32), 'hex');
        NEW.token_expires_at = NOW() + INTERVAL '7 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_assessment_token
    BEFORE INSERT ON public.assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_assessment_token();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage buckets (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES 
--     ('resumes', 'resumes', false),
--     ('videos', 'videos', false),
--     ('documents', 'documents', false);

-- ============================================
-- SEED DATA (Optional - for development)
-- ============================================

-- Uncomment to add sample data for testing

/*
-- Sample job
INSERT INTO public.jobs (
    title, department, location, job_type, remote_policy,
    summary, description, status
) VALUES (
    'Senior Software Engineer',
    'Engineering',
    'San Francisco, CA',
    'full-time',
    'hybrid',
    'We are looking for a Senior Software Engineer to join our growing team.',
    'As a Senior Software Engineer, you will design and build scalable systems...',
    'active'
);

-- Sample candidate
INSERT INTO public.candidates (
    email, first_name, last_name, source
) VALUES (
    'jane.doe@example.com',
    'Jane',
    'Doe',
    'linkedin'
);
*/
