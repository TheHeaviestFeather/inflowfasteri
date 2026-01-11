-- Create AI requests table for observability
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Request details
  prompt_version text,
  model text NOT NULL,
  message_count int NOT NULL,
  
  -- Response details
  latency_ms int,
  tokens_in int,
  tokens_out int,
  
  -- Content (for debugging - consider redaction in production)
  raw_output text,
  parsed_successfully boolean NOT NULL DEFAULT false,
  parse_errors text[],
  
  -- Artifact tracking
  artifact_type text,
  artifact_generated boolean NOT NULL DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own requests
CREATE POLICY "ai_requests_select_own" ON public.ai_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (edge functions use service role)
CREATE POLICY "ai_requests_insert_service" ON public.ai_requests
  FOR INSERT WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_ai_requests_user_id ON public.ai_requests(user_id);
CREATE INDEX idx_ai_requests_project_id ON public.ai_requests(project_id);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests(created_at DESC);
CREATE INDEX idx_ai_requests_request_id ON public.ai_requests(request_id);

-- Add index for failed parses (for debugging)
CREATE INDEX idx_ai_requests_parse_failures ON public.ai_requests(created_at DESC) 
  WHERE parsed_successfully = false;