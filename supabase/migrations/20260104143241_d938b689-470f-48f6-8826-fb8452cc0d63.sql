-- Add explicit DENY DELETE policies for immutable audit tables
-- token_usage: Deny UPDATE and DELETE for audit integrity
CREATE POLICY "token_usage_deny_update" ON public.token_usage
  FOR UPDATE USING (false);

CREATE POLICY "token_usage_deny_delete" ON public.token_usage
  FOR DELETE USING (false);

-- artifact_versions: Deny UPDATE for version immutability
CREATE POLICY "artifact_versions_deny_update" ON public.artifact_versions
  FOR UPDATE USING (false);

-- messages: Deny UPDATE and DELETE for conversation integrity
CREATE POLICY "messages_deny_update" ON public.messages
  FOR UPDATE USING (false);

CREATE POLICY "messages_deny_delete" ON public.messages
  FOR DELETE USING (false);

-- user_billing: Deny DELETE to preserve billing records for compliance
CREATE POLICY "user_billing_deny_delete" ON public.user_billing
  FOR DELETE USING (false);

-- profiles: Deny DELETE (user deletion should go through proper account deletion flow)
CREATE POLICY "profiles_deny_delete" ON public.profiles
  FOR DELETE USING (false);