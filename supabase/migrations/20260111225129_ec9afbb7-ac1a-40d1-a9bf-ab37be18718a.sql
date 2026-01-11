-- Create response_cache table for caching AI responses by prompt hash
CREATE TABLE public.response_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash TEXT NOT NULL UNIQUE,
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMP WITH TIME ZONE
);

-- Create index on prompt_hash for fast lookups
CREATE INDEX idx_response_cache_prompt_hash ON public.response_cache(prompt_hash);

-- Create index on expires_at for cleanup queries
CREATE INDEX idx_response_cache_expires_at ON public.response_cache(expires_at);

-- Enable RLS (only service role should access this table)
ALTER TABLE public.response_cache ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS policies - this is backend-only accessed via service role

-- Create a function to clean up expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.response_cache 
  WHERE expires_at < now();
END;
$$;

-- Create a function to increment hit count
CREATE OR REPLACE FUNCTION public.record_cache_hit(p_prompt_hash TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.response_cache
  SET hit_count = hit_count + 1,
      last_hit_at = now()
  WHERE prompt_hash = p_prompt_hash;
END;
$$;