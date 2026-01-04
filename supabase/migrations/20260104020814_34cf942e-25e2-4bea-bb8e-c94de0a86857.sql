-- Create user_billing table for sensitive payment data
CREATE TABLE public.user_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text NOT NULL DEFAULT 'free',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;

-- Strict RLS: Users can only see their own billing data
CREATE POLICY "user_billing_select_own" ON public.user_billing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_billing_insert_own" ON public.user_billing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_billing_update_own" ON public.user_billing
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No DELETE policy - billing records should be preserved

-- Add updated_at trigger
CREATE TRIGGER set_user_billing_updated_at
  BEFORE UPDATE ON public.user_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Migrate existing data from profiles to user_billing
INSERT INTO public.user_billing (user_id, stripe_customer_id, stripe_subscription_id, tier)
SELECT id, stripe_customer_id, stripe_subscription_id, tier
FROM public.profiles
WHERE stripe_customer_id IS NOT NULL 
   OR stripe_subscription_id IS NOT NULL 
   OR tier != 'free';

-- Insert billing records for remaining users (those with default tier)
INSERT INTO public.user_billing (user_id, tier)
SELECT id, 'free'
FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_billing);

-- Remove sensitive columns from profiles
ALTER TABLE public.profiles 
  DROP COLUMN stripe_customer_id,
  DROP COLUMN stripe_subscription_id,
  DROP COLUMN tier;