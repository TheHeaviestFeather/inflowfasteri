-- Add explicit DENY policy for response_cache table
-- This prevents authenticated users from accessing cached AI responses directly
CREATE POLICY "response_cache_deny_all_users"
ON public.response_cache
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);