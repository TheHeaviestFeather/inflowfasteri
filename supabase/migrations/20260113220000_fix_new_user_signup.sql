-- Fix: Ensure new users get both profile and billing records on signup
-- This addresses the issue where new users couldn't use the workspace because
-- their user_billing record was never created.

-- 1. Update handle_new_user() to also create user_billing record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for the new user
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;

  -- Create billing record for the new user with free tier defaults
  INSERT INTO public.user_billing (user_id, tier, credits_used, credits_limit)
  VALUES (NEW.id, 'free', 0, 50)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Backfill: Create user_billing records for any users who are missing them
-- This catches users who signed up after the initial migration but before this fix
INSERT INTO public.user_billing (user_id, tier, credits_used, credits_limit)
SELECT p.id, 'free', 0, 50
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_billing ub WHERE ub.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Also backfill any auth.users who might be missing profiles
-- (This handles edge cases where the trigger might have failed)
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data ->> 'full_name'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 4. And create billing for any users who now have profiles but still missing billing
INSERT INTO public.user_billing (user_id, tier, credits_used, credits_limit)
SELECT p.id, 'free', 0, 50
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_billing ub WHERE ub.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;
