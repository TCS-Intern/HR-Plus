-- User Credits System for Pay-Per-Reveal Model
-- Phase 5: Credits-based payment system

-- =====================================================
-- TABLE: user_credits
-- Tracks user credit balance for candidate reveals
-- =====================================================
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Credit balance
  credits INT NOT NULL DEFAULT 0 CHECK (credits >= 0),

  -- Usage tracking
  total_credits_purchased INT DEFAULT 0,
  total_credits_spent INT DEFAULT 0,
  total_reveals INT DEFAULT 0,

  -- Purchase history metadata
  last_purchase_at TIMESTAMPTZ,
  last_purchase_amount INT,
  last_purchase_package TEXT, -- "starter", "professional", "enterprise", etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
  ON user_credits FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: credit_transactions
-- Audit trail for all credit purchases and spending
-- =====================================================
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase',    -- User purchased credits
    'spend',       -- User spent credits (reveal)
    'refund',      -- Credits refunded
    'bonus',       -- Promotional credits
    'adjustment'   -- Manual adjustment
  )),

  -- Amount
  amount INT NOT NULL, -- Positive for purchase/refund/bonus, negative for spend
  balance_after INT NOT NULL, -- Balance after transaction

  -- Related records
  reveal_id UUID REFERENCES candidate_reveals(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES sourcing_conversations(id) ON DELETE SET NULL,

  -- Payment details (for purchases)
  payment_provider TEXT, -- "stripe", "paypal", etc.
  payment_id TEXT, -- External payment ID
  payment_status TEXT CHECK (payment_status IN (
    'pending',
    'completed',
    'failed',
    'refunded'
  )),

  -- Package details (for purchases)
  package_name TEXT, -- "starter", "professional", "enterprise"
  package_price_cents INT, -- Price in cents

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_reveal_id ON credit_transactions(reveal_id);

-- RLS policies
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTION: initialize_user_credits
-- Creates credits record for new users
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to auto-create credits record for new users
CREATE TRIGGER trigger_initialize_user_credits
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION initialize_user_credits();

-- =====================================================
-- FUNCTION: get_user_credits
-- Returns current credit balance for user
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INT;
BEGIN
  SELECT credits INTO v_credits
  FROM user_credits
  WHERE user_id = p_user_id;

  -- If no record exists, create one
  IF v_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN 0;
  END IF;

  RETURN v_credits;
END;
$$;

-- =====================================================
-- FUNCTION: add_credits
-- Adds credits to user balance (for purchases/bonuses)
-- =====================================================
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INT,
  p_transaction_type TEXT DEFAULT 'purchase',
  p_package_name TEXT DEFAULT NULL,
  p_package_price_cents INT DEFAULT NULL,
  p_payment_provider TEXT DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INT;
  v_transaction_id UUID;
BEGIN
  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Update user credits (with upsert)
  INSERT INTO user_credits (user_id, credits, total_credits_purchased)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET
    credits = user_credits.credits + p_amount,
    total_credits_purchased = user_credits.total_credits_purchased + p_amount,
    last_purchase_at = NOW(),
    last_purchase_amount = p_amount,
    last_purchase_package = p_package_name,
    updated_at = NOW()
  RETURNING credits INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    package_name,
    package_price_cents,
    payment_provider,
    payment_id,
    payment_status,
    description
  ) VALUES (
    p_user_id,
    p_transaction_type,
    p_amount,
    v_new_balance,
    p_package_name,
    p_package_price_cents,
    p_payment_provider,
    p_payment_id,
    'completed',
    p_description
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- =====================================================
-- FUNCTION: deduct_credits
-- Deducts credits from user balance (for reveals)
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INT,
  p_reveal_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_transaction_id UUID;
BEGIN
  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Get current balance
  SELECT credits INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE; -- Lock row for atomic operation

  -- Check sufficient balance
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'current_balance', COALESCE(v_current_balance, 0),
      'required', p_amount
    );
  END IF;

  -- Deduct credits
  UPDATE user_credits
  SET
    credits = credits - p_amount,
    total_credits_spent = total_credits_spent + p_amount,
    total_reveals = total_reveals + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING credits INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    reveal_id,
    conversation_id,
    payment_status,
    description
  ) VALUES (
    p_user_id,
    'spend',
    -p_amount, -- Negative for spending
    v_new_balance,
    p_reveal_id,
    p_conversation_id,
    'completed',
    COALESCE(p_description, 'Candidate reveal')
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount_deducted', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- =====================================================
-- FUNCTION: reveal_candidate_with_credits
-- Integrated reveal function with credit deduction
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
  v_reveal_result JSONB;
  v_reveal_id UUID;
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
    RETURN reveal_candidate(
      p_candidate_id,
      p_conversation_id,
      p_user_id,
      p_reveal_reason,
      0 -- No charge
    );
  END IF;

  -- Deduct credits first (atomic operation)
  v_deduct_result := deduct_credits(
    p_user_id,
    p_credits_cost,
    NULL, -- reveal_id will be updated after reveal
    p_conversation_id,
    'Reveal candidate ' || p_candidate_id::text
  );

  -- Check if deduction succeeded
  IF (v_deduct_result->>'success')::boolean = false THEN
    -- Insufficient credits
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'details', v_deduct_result
    );
  END IF;

  -- Perform reveal
  v_reveal_result := reveal_candidate(
    p_candidate_id,
    p_conversation_id,
    p_user_id,
    p_reveal_reason,
    p_credits_cost
  );

  -- Link transaction to reveal
  SELECT id INTO v_reveal_id
  FROM candidate_reveals
  WHERE user_id = p_user_id
  AND candidate_id = p_candidate_id
  AND conversation_id = p_conversation_id
  ORDER BY revealed_at DESC
  LIMIT 1;

  UPDATE credit_transactions
  SET reveal_id = v_reveal_id
  WHERE id = (v_deduct_result->>'transaction_id')::UUID;

  -- Return success with reveal data and credit info
  RETURN jsonb_build_object(
    'success', true,
    'candidate', v_reveal_result,
    'credits_charged', p_credits_cost,
    'new_balance', (v_deduct_result->>'new_balance')::int
  );
END;
$$;

-- =====================================================
-- FUNCTION: refund_reveal
-- Refunds credits for a reveal (admin/error handling)
-- =====================================================
CREATE OR REPLACE FUNCTION refund_reveal(
  p_reveal_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reveal RECORD;
  v_refund_result JSONB;
BEGIN
  -- Get reveal details
  SELECT * INTO v_reveal
  FROM candidate_reveals
  WHERE id = p_reveal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reveal not found';
  END IF;

  -- Check if already refunded
  IF v_reveal.payment_status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_refunded'
    );
  END IF;

  -- Add credits back
  v_refund_result := add_credits(
    v_reveal.user_id,
    v_reveal.credits_charged,
    'refund',
    NULL,
    NULL,
    NULL,
    NULL,
    COALESCE(p_reason, 'Refund for reveal ' || p_reveal_id::text)
  );

  -- Update reveal status
  UPDATE candidate_reveals
  SET
    payment_status = 'refunded',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{refund_reason}',
      to_jsonb(p_reason)
    )
  WHERE id = p_reveal_id;

  RETURN jsonb_build_object(
    'success', true,
    'refund_result', v_refund_result
  );
END;
$$;

-- =====================================================
-- VIEW: user_credit_summary
-- Convenient view for user credit stats
-- =====================================================
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT
  uc.user_id,
  uc.credits AS current_balance,
  uc.total_credits_purchased,
  uc.total_credits_spent,
  uc.total_reveals,
  uc.last_purchase_at,
  uc.last_purchase_amount,
  uc.last_purchase_package,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.transaction_type = 'purchase') AS total_purchases,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.transaction_type = 'spend') AS total_spends,
  uc.created_at,
  uc.updated_at
FROM user_credits uc
LEFT JOIN credit_transactions ct ON ct.user_id = uc.user_id
GROUP BY uc.user_id;

-- RLS for view
ALTER VIEW user_credit_summary SET (security_invoker = true);

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE user_credits IS 'User credit balances for pay-per-reveal model';
COMMENT ON TABLE credit_transactions IS 'Audit trail for all credit purchases and spending';
COMMENT ON FUNCTION get_user_credits IS 'Returns current credit balance for user';
COMMENT ON FUNCTION add_credits IS 'Adds credits to user balance for purchases/bonuses';
COMMENT ON FUNCTION deduct_credits IS 'Deducts credits from user balance for reveals';
COMMENT ON FUNCTION reveal_candidate_with_credits IS 'Integrated reveal with credit deduction';
COMMENT ON FUNCTION refund_reveal IS 'Refunds credits for a reveal';
