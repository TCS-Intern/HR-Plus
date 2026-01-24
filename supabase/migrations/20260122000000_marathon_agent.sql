-- Migration: Marathon Agent Tables
-- Description: Adds tables for Marathon Agent state management, thought signatures, and decision tracking
-- Created: 2026-01-22

-- ============================================
-- MARATHON AGENT STATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS marathon_agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,

    -- Thought Signature (persistent memory across stages)
    thought_signature JSONB NOT NULL DEFAULT '{
        "core_strengths": [],
        "concerns": [],
        "hiring_thesis": "To be developed",
        "decision_confidence": 0.5,
        "stage_insights": {},
        "self_corrections": []
    }'::jsonb,

    decision_confidence FLOAT NOT NULL DEFAULT 0.5 CHECK (decision_confidence >= 0 AND decision_confidence <= 1),

    -- Current state
    current_stage TEXT NOT NULL DEFAULT 'screening',
    stage_status TEXT NOT NULL DEFAULT 'pending' CHECK (stage_status IN ('pending', 'in_progress', 'completed', 'blocked', 'escalated')),

    -- Progression rules
    can_auto_advance BOOLEAN DEFAULT false,
    requires_human_review BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    escalation_reason TEXT,

    -- Self-correction tracking
    correction_count INT DEFAULT 0,
    last_correction_at TIMESTAMPTZ,

    -- Agent metadata
    agent_run_id TEXT,
    last_agent_action TEXT,
    last_agent_reasoning TEXT,
    next_scheduled_action TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_marathon_job_id ON marathon_agent_state(job_id);
CREATE INDEX idx_marathon_application_id ON marathon_agent_state(application_id);
CREATE INDEX idx_marathon_stage_status ON marathon_agent_state(current_stage, stage_status);
CREATE INDEX idx_marathon_next_action ON marathon_agent_state(next_scheduled_action)
    WHERE stage_status != 'completed' AND stage_status != 'escalated';
CREATE INDEX idx_marathon_requires_review ON marathon_agent_state(requires_human_review)
    WHERE requires_human_review = true;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_marathon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marathon_agent_state_updated_at
    BEFORE UPDATE ON marathon_agent_state
    FOR EACH ROW
    EXECUTE FUNCTION update_marathon_updated_at();

-- ============================================
-- MARATHON AGENT DECISIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS marathon_agent_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marathon_state_id UUID NOT NULL REFERENCES marathon_agent_state(id) ON DELETE CASCADE,

    -- Decision details
    stage TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK (decision_type IN ('advance', 'reject', 'escalate', 'self_correct', 'hold')),
    reasoning TEXT NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

    -- What changed
    previous_thought_signature JSONB,
    new_thought_signature JSONB,

    -- Metadata
    agent_run_id TEXT,
    processing_time_ms INT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_marathon_state ON marathon_agent_decisions(marathon_state_id);
CREATE INDEX idx_decisions_stage ON marathon_agent_decisions(stage);
CREATE INDEX idx_decisions_type ON marathon_agent_decisions(decision_type);
CREATE INDEX idx_decisions_created_at ON marathon_agent_decisions(created_at DESC);

-- ============================================
-- MARATHON AGENT EVENTS TABLE (for audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS marathon_agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marathon_state_id UUID NOT NULL REFERENCES marathon_agent_state(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    event_data JSONB,
    message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_marathon_state ON marathon_agent_events(marathon_state_id);
CREATE INDEX idx_events_type ON marathon_agent_events(event_type);
CREATE INDEX idx_events_created_at ON marathon_agent_events(created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get active marathons count
CREATE OR REPLACE FUNCTION get_active_marathons_count()
RETURNS INT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM marathon_agent_state
        WHERE stage_status IN ('pending', 'in_progress', 'blocked')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get marathons requiring review
CREATE OR REPLACE FUNCTION get_marathons_requiring_review()
RETURNS TABLE (
    id UUID,
    job_id UUID,
    application_id UUID,
    current_stage TEXT,
    decision_confidence FLOAT,
    escalation_reason TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.job_id,
        m.application_id,
        m.current_stage,
        m.decision_confidence,
        m.escalation_reason,
        m.created_at
    FROM marathon_agent_state m
    WHERE m.requires_human_review = true
        AND m.stage_status = 'escalated'
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to record a decision
CREATE OR REPLACE FUNCTION record_marathon_decision(
    p_marathon_state_id UUID,
    p_stage TEXT,
    p_decision_type TEXT,
    p_reasoning TEXT,
    p_confidence FLOAT,
    p_previous_signature JSONB,
    p_new_signature JSONB,
    p_agent_run_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_decision_id UUID;
BEGIN
    INSERT INTO marathon_agent_decisions (
        marathon_state_id,
        stage,
        decision_type,
        reasoning,
        confidence,
        previous_thought_signature,
        new_thought_signature,
        agent_run_id
    ) VALUES (
        p_marathon_state_id,
        p_stage,
        p_decision_type,
        p_reasoning,
        p_confidence,
        p_previous_signature,
        p_new_signature,
        p_agent_run_id
    )
    RETURNING id INTO v_decision_id;

    RETURN v_decision_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record an event
CREATE OR REPLACE FUNCTION record_marathon_event(
    p_marathon_state_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT NULL,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO marathon_agent_events (
        marathon_state_id,
        event_type,
        event_data,
        message
    ) VALUES (
        p_marathon_state_id,
        p_event_type,
        p_event_data,
        p_message
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE marathon_agent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_agent_events ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for authenticated users - refine based on your auth setup)
CREATE POLICY "Allow all operations for authenticated users"
    ON marathon_agent_state
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users"
    ON marathon_agent_decisions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users"
    ON marathon_agent_events
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE marathon_agent_state IS 'Tracks the state of Marathon Agent processes for each candidate';
COMMENT ON TABLE marathon_agent_decisions IS 'Records all decisions made by the Marathon Agent';
COMMENT ON TABLE marathon_agent_events IS 'Audit trail of all Marathon Agent events';

COMMENT ON COLUMN marathon_agent_state.thought_signature IS 'Persistent memory of candidate evaluation across stages';
COMMENT ON COLUMN marathon_agent_state.decision_confidence IS 'Agent confidence in current assessment (0-1)';
COMMENT ON COLUMN marathon_agent_state.current_stage IS 'Current hiring stage: screening, phone_screen, assessment, offer';
COMMENT ON COLUMN marathon_agent_state.can_auto_advance IS 'Whether agent can progress candidate automatically';
COMMENT ON COLUMN marathon_agent_state.requires_human_review IS 'Whether human intervention is needed';
