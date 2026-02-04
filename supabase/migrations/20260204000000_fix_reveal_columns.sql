-- Fix column references in reveal functions
-- The sourced_candidates table uses current_title and current_company, not role and company

-- =====================================================
-- Fix: get_anonymized_candidate function
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
  -- Fetch candidate data (using correct column names)
  SELECT jsonb_build_object(
    'id', id,
    'role', current_title,
    'company', current_company,
    'location', location,
    'experience_years', experience_years,
    'skills', skills,
    'source', source,
    'summary', summary,
    'fit_score', fit_score,
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'phone', phone,
    'linkedin_url', source_url
  )
  INTO v_candidate
  FROM sourced_candidates
  WHERE id = p_candidate_id;

  IF v_candidate IS NULL THEN
    RETURN NULL;
  END IF;

  -- Anonymize PII
  v_anonymized := jsonb_build_object(
    'id', v_candidate->>'id',
    'role', v_candidate->>'role',
    'company', v_candidate->>'company',
    'location', CASE
      WHEN v_candidate->>'location' IS NOT NULL
      THEN split_part(v_candidate->>'location', ',', 1)
      ELSE NULL
    END,
    'experience_years', (v_candidate->>'experience_years')::int,
    'skills', v_candidate->'skills',
    'source', v_candidate->>'source',
    'summary', v_candidate->>'summary',
    'fit_score', (v_candidate->>'fit_score')::numeric,
    'is_anonymized', true,
    'name', 'Candidate #' || LEFT(v_candidate->>'id', 8)
  );

  RETURN v_anonymized;
END;
$$;


-- =====================================================
-- Fix: reveal_candidate function
-- =====================================================
CREATE OR REPLACE FUNCTION reveal_candidate(
  p_candidate_id UUID,
  p_conversation_id UUID,
  p_user_id UUID,
  p_reveal_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_revealed BOOLEAN;
  v_reveal_id UUID;
BEGIN
  -- Check if already revealed
  SELECT EXISTS(
    SELECT 1 FROM candidate_reveals
    WHERE user_id = p_user_id
    AND candidate_id = p_candidate_id
    AND conversation_id = p_conversation_id
  ) INTO v_already_revealed;

  IF v_already_revealed THEN
    -- Return full data without recording (already revealed)
    SELECT jsonb_build_object(
      'id', id,
      'role', current_title,
      'company', current_company,
      'location', location,
      'experience_years', experience_years,
      'skills', skills,
      'source', source,
      'summary', summary,
      'fit_score', fit_score,
      'is_anonymized', false,
      'name', COALESCE(first_name || ' ' || last_name, 'Unknown'),
      'first_name', first_name,
      'last_name', last_name,
      'email', email,
      'phone', phone,
      'linkedin_url', source_url,
      'already_revealed', true
    )
    FROM sourced_candidates
    WHERE id = p_candidate_id;
  END IF;

  -- Record the reveal
  INSERT INTO candidate_reveals (
    user_id,
    candidate_id,
    conversation_id,
    reveal_reason,
    revealed_at
  ) VALUES (
    p_user_id,
    p_candidate_id,
    p_conversation_id,
    p_reveal_reason,
    NOW()
  )
  RETURNING id INTO v_reveal_id;

  -- Return full candidate data
  RETURN (
    SELECT jsonb_build_object(
      'id', id,
      'role', current_title,
      'company', current_company,
      'location', location,
      'experience_years', experience_years,
      'skills', skills,
      'source', source,
      'summary', summary,
      'fit_score', fit_score,
      'is_anonymized', false,
      'name', COALESCE(first_name || ' ' || last_name, 'Unknown'),
      'first_name', first_name,
      'last_name', last_name,
      'email', email,
      'phone', phone,
      'linkedin_url', source_url,
      'reveal_id', v_reveal_id
    )
    FROM sourced_candidates
    WHERE id = p_candidate_id
  );
END;
$$;


-- =====================================================
-- Fix: reveal_candidate_with_credits function
-- =====================================================
CREATE OR REPLACE FUNCTION reveal_candidate_with_credits(
  p_candidate_id UUID,
  p_conversation_id UUID,
  p_user_id UUID,
  p_reveal_reason TEXT DEFAULT NULL,
  p_credits_cost INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_revealed BOOLEAN;
  v_deduct_result JSONB;
  v_reveal_id UUID;
  v_candidate JSONB;
BEGIN
  -- Check if already revealed (no charge if already revealed)
  SELECT EXISTS(
    SELECT 1 FROM candidate_reveals
    WHERE user_id = p_user_id
    AND candidate_id = p_candidate_id
    AND conversation_id = p_conversation_id
  ) INTO v_already_revealed;

  IF v_already_revealed THEN
    -- Return full data without charging
    SELECT jsonb_build_object(
      'success', true,
      'already_revealed', true,
      'credits_charged', 0,
      'candidate', jsonb_build_object(
        'id', id,
        'role', current_title,
        'company', current_company,
        'location', location,
        'experience_years', experience_years,
        'skills', skills,
        'source', source,
        'summary', summary,
        'fit_score', fit_score,
        'is_anonymized', false,
        'name', COALESCE(first_name || ' ' || last_name, 'Unknown'),
        'first_name', first_name,
        'last_name', last_name,
        'email', email,
        'phone', phone,
        'linkedin_url', source_url
      )
    )
    INTO v_candidate
    FROM sourced_candidates
    WHERE id = p_candidate_id;

    RETURN v_candidate;
  END IF;

  -- Deduct credits
  v_deduct_result := deduct_credits(p_user_id, p_credits_cost, NULL, p_conversation_id, 'Candidate reveal');

  IF NOT (v_deduct_result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_deduct_result->>'error',
      'credits_charged', 0
    );
  END IF;

  -- Record the reveal (use credits_charged column)
  INSERT INTO candidate_reveals (
    user_id,
    candidate_id,
    conversation_id,
    reveal_reason,
    credits_charged,
    revealed_at
  ) VALUES (
    p_user_id,
    p_candidate_id,
    p_conversation_id,
    p_reveal_reason,
    p_credits_cost,
    NOW()
  )
  RETURNING id INTO v_reveal_id;

  -- Update transaction with reveal_id
  UPDATE credit_transactions
  SET reveal_id = v_reveal_id
  WHERE id = (v_deduct_result->>'transaction_id')::UUID;

  -- Return full candidate data
  SELECT jsonb_build_object(
    'success', true,
    'reveal_id', v_reveal_id,
    'credits_charged', p_credits_cost,
    'new_balance', (v_deduct_result->>'new_balance')::int,
    'candidate', jsonb_build_object(
      'id', id,
      'role', current_title,
      'company', current_company,
      'location', location,
      'experience_years', experience_years,
      'skills', skills,
      'source', source,
      'summary', summary,
      'fit_score', fit_score,
      'is_anonymized', false,
      'name', COALESCE(first_name || ' ' || last_name, 'Unknown'),
      'first_name', first_name,
      'last_name', last_name,
      'email', email,
      'phone', phone,
      'linkedin_url', source_url
    )
  )
  INTO v_candidate
  FROM sourced_candidates
  WHERE id = p_candidate_id;

  RETURN v_candidate;
END;
$$;


-- Add comments
COMMENT ON FUNCTION get_anonymized_candidate IS 'Returns anonymized candidate data (hides PII)';
COMMENT ON FUNCTION reveal_candidate IS 'Reveals full candidate data and records the reveal';
COMMENT ON FUNCTION reveal_candidate_with_credits IS 'Reveals candidate with credit deduction';
