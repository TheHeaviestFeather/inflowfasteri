-- Fix 1: Move pg_net extension from public to extensions schema
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Fix 2: Replace overly permissive ai_requests_insert_service policy
-- The current policy uses WITH CHECK (true) which allows any user to insert
DROP POLICY IF EXISTS "ai_requests_insert_service" ON public.ai_requests;

-- Create a secure policy that only allows authenticated users to insert their own records
CREATE POLICY "ai_requests_insert_own" ON public.ai_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);