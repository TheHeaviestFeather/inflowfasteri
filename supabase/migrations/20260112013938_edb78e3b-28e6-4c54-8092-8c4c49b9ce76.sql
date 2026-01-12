-- PRIORITY 1: Fix RLS Policy Conflicts

-- 1.1 Fix Messages Table - Implement soft-delete instead of hard delete
-- Drop the permissive delete policy that conflicts with messages_deny_delete
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;

-- Add soft-delete column for messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Update the SELECT policy to filter out soft-deleted messages
DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
CREATE POLICY "messages_select_own" ON public.messages
FOR SELECT USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.user_id = auth.uid()
  )
);

-- Create an UPDATE policy for soft-delete operations
DROP POLICY IF EXISTS "messages_soft_delete_own" ON public.messages;
CREATE POLICY "messages_soft_delete_own" ON public.messages
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.user_id = auth.uid()
  )
);

-- 1.2 Fix Rate Limits RLS Policy
-- Drop the permissive policy that allows authenticated users to bypass rate limiting
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;