-- Create a view for projects with stats to eliminate N+1 queries
CREATE OR REPLACE VIEW projects_with_stats AS
SELECT 
  p.*,
  COALESCE((SELECT COUNT(*) FROM messages m WHERE m.project_id = p.id), 0)::int as message_count,
  COALESCE((SELECT COUNT(*) FROM artifacts a WHERE a.project_id = p.id), 0)::int as artifact_count
FROM projects p;

-- Grant access to authenticated users (view inherits RLS from underlying tables)
GRANT SELECT ON projects_with_stats TO authenticated;

-- Create a rate_limits table for tracking API usage per user
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint, window_start)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can manage rate limits (edge functions use service role)
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint 
ON public.rate_limits(user_id, endpoint, window_start DESC);

-- Create a function to check and increment rate limit
-- Returns true if request is allowed, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests int DEFAULT 30,
  p_window_seconds int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamp with time zone;
  v_current_count int;
BEGIN
  -- Calculate the current window start (truncate to window boundary)
  v_window_start := date_trunc('minute', now());
  
  -- Try to insert or update the rate limit record
  INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, v_window_start)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Check if over limit
  IF v_current_count > p_max_requests THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Cleanup old rate limit records (keep last 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < now() - interval '24 hours';
END;
$$;