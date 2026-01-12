-- Add credits system to user_billing table
-- Each AI message costs 1 credit, free users get 50 credits

-- Add credits column to user_billing
ALTER TABLE public.user_billing
ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 50;

-- Create credit_usage table to track credit consumption
CREATE TABLE IF NOT EXISTS public.credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  credits_used integer NOT NULL DEFAULT 1,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS credit_usage_user_id_idx ON public.credit_usage(user_id);
CREATE INDEX IF NOT EXISTS credit_usage_created_at_idx ON public.credit_usage(created_at);

-- Enable RLS on credit_usage
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own credit usage
CREATE POLICY "credit_usage_select_own" ON public.credit_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert credit usage (done by edge function)
CREATE POLICY "credit_usage_insert_service" ON public.credit_usage
  FOR INSERT WITH CHECK (true);

-- Function to check and deduct credits atomically
CREATE OR REPLACE FUNCTION public.use_credit(
  p_user_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_message_id uuid DEFAULT NULL,
  p_credits integer DEFAULT 1,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits integer;
  v_tier text;
  v_new_credits integer;
BEGIN
  -- Get current credits with row lock to prevent race conditions
  SELECT credits, tier INTO v_current_credits, v_tier
  FROM public.user_billing
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no billing record, create one with default 50 credits
  IF v_current_credits IS NULL THEN
    INSERT INTO public.user_billing (user_id, credits, tier)
    VALUES (p_user_id, 50, 'free')
    ON CONFLICT (user_id) DO NOTHING;

    SELECT credits, tier INTO v_current_credits, v_tier
    FROM public.user_billing
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  -- Check if user has enough credits
  IF v_current_credits < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'credits_remaining', v_current_credits,
      'credits_required', p_credits
    );
  END IF;

  -- Deduct credits
  v_new_credits := v_current_credits - p_credits;

  UPDATE public.user_billing
  SET credits = v_new_credits, updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the usage
  INSERT INTO public.credit_usage (user_id, project_id, message_id, credits_used, description)
  VALUES (p_user_id, p_project_id, p_message_id, p_credits, p_description);

  RETURN jsonb_build_object(
    'success', true,
    'credits_remaining', v_new_credits,
    'credits_used', p_credits
  );
END;
$$;

-- Function to check credits without deducting (for UI display)
CREATE OR REPLACE FUNCTION public.check_credits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits integer;
  v_tier text;
BEGIN
  SELECT credits, tier INTO v_credits, v_tier
  FROM public.user_billing
  WHERE user_id = p_user_id;

  -- If no billing record exists, return default
  IF v_credits IS NULL THEN
    RETURN jsonb_build_object(
      'credits', 50,
      'tier', 'free'
    );
  END IF;

  RETURN jsonb_build_object(
    'credits', v_credits,
    'tier', v_tier
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.use_credit TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_credit TO service_role;
GRANT EXECUTE ON FUNCTION public.check_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credits TO service_role;
