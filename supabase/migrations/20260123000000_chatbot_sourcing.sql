-- Chatbot-Based Candidate Sourcing Schema
-- Phase 1: Core tables for conversational sourcing with pay-per-reveal model

-- =====================================================
-- TABLE: sourcing_conversations
-- Tracks chat sessions with the sourcing assistant agent
-- =====================================================
CREATE TABLE sourcing_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Conversation state
  stage TEXT NOT NULL DEFAULT 'greeting' CHECK (stage IN (
    'greeting',
    'requirements_gathering',
    'confirmation',
    'sourcing',
    'presenting_results',
    'refinement',
    'completed',
    'abandoned'
  )),

  -- Agent session management
  agent_session_id TEXT, -- Google ADK session ID for continuity
  thought_signature JSONB DEFAULT '{}'::jsonb, -- Context preservation (like Marathon Agent)

  -- Extracted sourcing criteria
  sourcing_criteria JSONB DEFAULT '{}'::jsonb, -- Skills, experience, location, etc.
  -- Example: {
  --   "role": "Senior Backend Engineer",
  --   "required_skills": ["Python", "Django", "PostgreSQL"],
  --   "nice_to_have_skills": ["AWS", "Docker"],
  --   "experience_years_min": 5,
  --   "location": "San Francisco",
  --   "remote_policy": "remote_ok"
  -- }

  -- Job linkage (optional - if converting to formal job)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Metadata
  candidates_found_count INT DEFAULT 0,
  candidates_revealed_count INT DEFAULT 0,
  total_messages_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sourcing_conversations_user_id ON sourcing_conversations(user_id);
CREATE INDEX idx_sourcing_conversations_stage ON sourcing_conversations(stage);
CREATE INDEX idx_sourcing_conversations_job_id ON sourcing_conversations(job_id);
CREATE INDEX idx_sourcing_conversations_last_activity ON sourcing_conversations(last_activity_at DESC);

-- RLS policies
ALTER TABLE sourcing_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON sourcing_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON sourcing_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON sourcing_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: sourcing_messages
-- Individual messages in the conversation
-- =====================================================
CREATE TABLE sourcing_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES sourcing_conversations(id) ON DELETE CASCADE,

  -- Message metadata
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text',           -- Regular text message
    'question',       -- Highlighted question from agent
    'candidate_cards', -- Embedded candidate cards
    'thinking',       -- Agent thinking indicator
    'error'           -- Error message
  )),

  -- Message content
  content TEXT, -- Text content (for text/question/error types)

  -- Candidate references (for candidate_cards type)
  candidate_ids UUID[] DEFAULT ARRAY[]::UUID[], -- References to sourced_candidates

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Search timing, counts, error details, etc.
  -- Example metadata for candidate_cards:
  -- {
  --   "search_duration_ms": 12500,
  --   "total_found": 23,
  --   "showing_count": 10,
  --   "platforms": ["linkedin", "github"]
  -- }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sourcing_messages_conversation_id ON sourcing_messages(conversation_id);
CREATE INDEX idx_sourcing_messages_created_at ON sourcing_messages(created_at);
CREATE INDEX idx_sourcing_messages_role ON sourcing_messages(role);

-- RLS policies
ALTER TABLE sourcing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON sourcing_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sourcing_conversations
      WHERE sourcing_conversations.id = sourcing_messages.conversation_id
      AND sourcing_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON sourcing_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_conversations
      WHERE sourcing_conversations.id = sourcing_messages.conversation_id
      AND sourcing_conversations.user_id = auth.uid()
    )
  );

-- =====================================================
-- TABLE: candidate_reveals
-- Audit trail for pay-per-reveal model
-- =====================================================
CREATE TABLE candidate_reveals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who revealed what
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES sourced_candidates(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES sourcing_conversations(id) ON DELETE CASCADE,

  -- Reveal details
  revealed_fields JSONB NOT NULL DEFAULT '{
    "name": true,
    "email": true,
    "phone": true,
    "linkedin_url": true
  }'::jsonb,

  reveal_reason TEXT, -- "interested", "shortlist", "interview", etc.

  -- Billing integration point
  credits_charged INT NOT NULL DEFAULT 1, -- How many credits were charged
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN (
    'pending',
    'completed',
    'failed',
    'refunded'
  )),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Payment details, transaction ID, etc.

  -- Timestamps
  revealed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_candidate_reveals_user_id ON candidate_reveals(user_id);
CREATE INDEX idx_candidate_reveals_candidate_id ON candidate_reveals(candidate_id);
CREATE INDEX idx_candidate_reveals_conversation_id ON candidate_reveals(conversation_id);
CREATE INDEX idx_candidate_reveals_revealed_at ON candidate_reveals(revealed_at DESC);

-- Unique constraint: user can only reveal same candidate once per conversation
CREATE UNIQUE INDEX idx_unique_reveal_per_conversation
  ON candidate_reveals(user_id, candidate_id, conversation_id);

-- RLS policies
ALTER TABLE candidate_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reveals"
  ON candidate_reveals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reveals"
  ON candidate_reveals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- UPDATE: sourced_candidates table
-- Add anonymization tracking fields
-- =====================================================
ALTER TABLE sourced_candidates
  ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS revealed_in_conversation UUID REFERENCES sourcing_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sourced_candidates_is_anonymized
  ON sourced_candidates(is_anonymized);

-- =====================================================
-- FUNCTION: get_anonymized_candidate
-- Returns candidate data with PII hidden
-- =====================================================
CREATE OR REPLACE FUNCTION get_anonymized_candidate(p_candidate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate JSONB;
  v_anonymized JSONB;
BEGIN
  -- Fetch candidate data
  SELECT jsonb_build_object(
    'id', id,
    'role', role,
    'company', company,
    'location', location,
    'experience_years', experience_years,
    'skills', skills,
    'summary', summary,
    'fit_score', fit_score,
    'source', source,
    'is_anonymized', is_anonymized,
    'name', name,
    'email', email,
    'phone', phone,
    'linkedin_url', linkedin_url
  )
  INTO v_candidate
  FROM sourced_candidates
  WHERE id = p_candidate_id;

  -- If candidate doesn't exist, return null
  IF v_candidate IS NULL THEN
    RETURN NULL;
  END IF;

  -- If already revealed (not anonymized), return full data
  IF (v_candidate->>'is_anonymized')::boolean = false THEN
    RETURN v_candidate;
  END IF;

  -- Anonymize PII
  v_anonymized := jsonb_build_object(
    'id', v_candidate->>'id',
    'role', v_candidate->>'role',
    'company', v_candidate->>'company',

    -- Location: show only city, not full address
    'location', COALESCE(
      split_part(v_candidate->>'location', ',', 1), -- First part before comma (city)
      v_candidate->>'location'
    ),

    'experience_years', v_candidate->>'experience_years',
    'skills', v_candidate->'skills',

    -- Summary: truncate to 200 chars
    'summary', CASE
      WHEN length(v_candidate->>'summary') > 200 THEN
        substring(v_candidate->>'summary', 1, 200) || '...'
      ELSE
        v_candidate->>'summary'
    END,

    'fit_score', v_candidate->>'fit_score',
    'source', v_candidate->>'source',
    'is_anonymized', true,

    -- Hide PII with masked values
    'name', 'Candidate #' || substring(v_candidate->>'id', 1, 8),
    'email', null,
    'phone', null,
    'linkedin_url', null
  );

  RETURN v_anonymized;
END;
$$;

-- =====================================================
-- FUNCTION: reveal_candidate
-- Reveals candidate PII and records in audit trail
-- =====================================================
CREATE OR REPLACE FUNCTION reveal_candidate(
  p_candidate_id UUID,
  p_conversation_id UUID,
  p_user_id UUID,
  p_reveal_reason TEXT DEFAULT NULL,
  p_credits_charged INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revealed JSONB;
  v_already_revealed BOOLEAN;
BEGIN
  -- Check if already revealed by this user in this conversation
  SELECT EXISTS(
    SELECT 1 FROM candidate_reveals
    WHERE user_id = p_user_id
    AND candidate_id = p_candidate_id
    AND conversation_id = p_conversation_id
  ) INTO v_already_revealed;

  -- If already revealed, just return the full data (no charge)
  IF v_already_revealed THEN
    SELECT jsonb_build_object(
      'id', id,
      'role', role,
      'company', company,
      'location', location,
      'experience_years', experience_years,
      'skills', skills,
      'summary', summary,
      'fit_score', fit_score,
      'source', source,
      'is_anonymized', false,
      'name', name,
      'email', email,
      'phone', phone,
      'linkedin_url', linkedin_url,
      'already_revealed', true
    )
    INTO v_revealed
    FROM sourced_candidates
    WHERE id = p_candidate_id;

    RETURN v_revealed;
  END IF;

  -- Record reveal in audit trail
  INSERT INTO candidate_reveals (
    user_id,
    candidate_id,
    conversation_id,
    reveal_reason,
    credits_charged,
    payment_status
  ) VALUES (
    p_user_id,
    p_candidate_id,
    p_conversation_id,
    p_reveal_reason,
    p_credits_charged,
    'completed'
  );

  -- Update sourced_candidates table
  UPDATE sourced_candidates
  SET
    is_anonymized = false,
    revealed_in_conversation = p_conversation_id,
    revealed_at = NOW()
  WHERE id = p_candidate_id;

  -- Update conversation stats
  UPDATE sourcing_conversations
  SET
    candidates_revealed_count = candidates_revealed_count + 1,
    updated_at = NOW()
  WHERE id = p_conversation_id;

  -- Return full candidate data
  SELECT jsonb_build_object(
    'id', id,
    'role', role,
    'company', company,
    'location', location,
    'experience_years', experience_years,
    'skills', skills,
    'summary', summary,
    'fit_score', fit_score,
    'source', source,
    'is_anonymized', false,
    'name', name,
    'email', email,
    'phone', phone,
    'linkedin_url', linkedin_url,
    'already_revealed', false
  )
  INTO v_revealed
  FROM sourced_candidates
  WHERE id = p_candidate_id;

  RETURN v_revealed;
END;
$$;

-- =====================================================
-- TRIGGER: Update conversation timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sourcing_conversations
  SET
    last_activity_at = NOW(),
    updated_at = NOW(),
    total_messages_count = total_messages_count + 1
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON sourcing_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE sourcing_conversations IS 'Tracks chat sessions with the sourcing assistant agent';
COMMENT ON TABLE sourcing_messages IS 'Individual messages in sourcing conversations';
COMMENT ON TABLE candidate_reveals IS 'Audit trail for pay-per-reveal candidate model';
COMMENT ON FUNCTION get_anonymized_candidate IS 'Returns candidate data with PII hidden for anonymization';
COMMENT ON FUNCTION reveal_candidate IS 'Reveals candidate PII and records in audit trail with billing integration point';
