-- Web Interview Support Migration
-- Adds columns to phone_screens table to support web-based interviews
-- alongside traditional Vapi phone calls

-- Add interview_mode column to distinguish between phone, web, and simulation interviews
ALTER TABLE public.phone_screens
    ADD COLUMN IF NOT EXISTS interview_mode VARCHAR(20) DEFAULT 'phone';
-- Values: 'phone' (Vapi call), 'web' (browser chat), 'simulation' (recruiter preview)

-- Add access_token for candidate web access (similar to assessments)
ALTER TABLE public.phone_screens
    ADD COLUMN IF NOT EXISTS access_token VARCHAR(64) UNIQUE;

-- Add token expiration
ALTER TABLE public.phone_screens
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Add conversation_state to track web interview progress
ALTER TABLE public.phone_screens
    ADD COLUMN IF NOT EXISTS conversation_state JSONB DEFAULT '{}'::jsonb;
-- {current_question_index: 0, questions_asked: [], is_complete: false}

-- Add index for token lookups
CREATE INDEX IF NOT EXISTS idx_phone_screens_access_token
    ON public.phone_screens(access_token);

-- Function to generate web interview access token
CREATE OR REPLACE FUNCTION public.generate_phone_screen_access_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.interview_mode = 'web' AND NEW.access_token IS NULL THEN
        NEW.access_token = encode(gen_random_bytes(32), 'hex');
        NEW.token_expires_at = NOW() + INTERVAL '7 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate token for web interviews
DROP TRIGGER IF EXISTS set_phone_screen_access_token ON public.phone_screens;
CREATE TRIGGER set_phone_screen_access_token
    BEFORE INSERT ON public.phone_screens
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_phone_screen_access_token();

-- Comment for documentation
COMMENT ON COLUMN public.phone_screens.interview_mode IS 'Interview type: phone (Vapi), web (browser chat), simulation (recruiter test)';
COMMENT ON COLUMN public.phone_screens.access_token IS 'Unique token for candidate web interview access (no auth required)';
COMMENT ON COLUMN public.phone_screens.token_expires_at IS 'Expiration timestamp for the access token';
COMMENT ON COLUMN public.phone_screens.conversation_state IS 'Tracks web interview progress: current question, history, completion status';
