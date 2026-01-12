-- Fix CRITICAL: Remove conflicting messages_delete_own policy
-- (messages_deny_delete exists and should be the only delete policy)
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;

-- Fix CRITICAL: Remove overly permissive rate_limits policy
-- Rate limits should only be managed by service role (via SECURITY DEFINER functions)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;

-- Add a proper restrictive policy - no user should directly access rate_limits
-- The check_rate_limit function uses SECURITY DEFINER and bypasses RLS
CREATE POLICY "rate_limits_deny_all_users"
ON public.rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);