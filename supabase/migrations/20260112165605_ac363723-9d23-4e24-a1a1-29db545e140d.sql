-- Add credits tracking to user_billing
ALTER TABLE public.user_billing 
ADD COLUMN credits_used integer NOT NULL DEFAULT 0,
ADD COLUMN credits_limit integer NOT NULL DEFAULT 50;

-- Create a function to check and increment credits
CREATE OR REPLACE FUNCTION public.check_and_use_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits_used integer;
  v_credits_limit integer;
  v_tier text;
BEGIN
  -- Get current credits and tier
  SELECT credits_used, credits_limit, tier INTO v_credits_used, v_credits_limit, v_tier
  FROM user_billing
  WHERE user_id = p_user_id;
  
  -- If no billing record, create one with defaults
  IF NOT FOUND THEN
    INSERT INTO user_billing (user_id, credits_used, credits_limit, tier)
    VALUES (p_user_id, 1, 50, 'free')
    RETURNING credits_used, credits_limit, tier INTO v_credits_used, v_credits_limit, v_tier;
    RETURN true;
  END IF;
  
  -- Pro users have unlimited credits
  IF v_tier = 'pro' THEN
    UPDATE user_billing SET credits_used = credits_used + 1 WHERE user_id = p_user_id;
    RETURN true;
  END IF;
  
  -- Check if user has credits remaining
  IF v_credits_used >= v_credits_limit THEN
    RETURN false;
  END IF;
  
  -- Increment credits used
  UPDATE user_billing SET credits_used = credits_used + 1 WHERE user_id = p_user_id;
  RETURN true;
END;
$$;

-- Create function to get user credits info
CREATE OR REPLACE FUNCTION public.get_user_credits(p_user_id uuid)
RETURNS TABLE(credits_used integer, credits_limit integer, tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ub.credits_used, ub.credits_limit, ub.tier
  FROM user_billing ub
  WHERE ub.user_id = p_user_id;
  
  -- If no record found, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 50, 'free'::text;
  END IF;
END;
$$;