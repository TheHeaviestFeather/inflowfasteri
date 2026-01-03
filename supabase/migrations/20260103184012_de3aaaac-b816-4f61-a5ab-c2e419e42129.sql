-- Fix function search_path security warning
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add policy for system_prompts (server-managed, but authenticated users can read active ones)
CREATE POLICY "system_prompts_read_active"
ON public.system_prompts
FOR SELECT
USING (is_active = true);