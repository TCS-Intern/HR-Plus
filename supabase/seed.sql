-- Seed data for local development

-- Create a default auth user (Supabase local dev)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@telentic.local',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Create the profile
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev@telentic.local',
  'Dev User',
  'recruiter'
) ON CONFLICT (id) DO NOTHING;

-- Give the default user some credits
INSERT INTO user_credits (user_id, credits, total_credits_purchased)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  100,
  100
) ON CONFLICT (user_id) DO NOTHING;
