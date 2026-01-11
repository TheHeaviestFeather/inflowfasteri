-- Create project_metrics table for success tracking
CREATE TABLE public.project_metrics (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  first_artifact_at timestamp with time zone,
  first_approval_at timestamp with time zone,
  completed_at timestamp with time zone,
  total_messages integer DEFAULT 0,
  total_artifacts integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own project metrics
CREATE POLICY "project_metrics_select_own" ON public.project_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_metrics.project_id 
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_metrics_insert_own" ON public.project_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_metrics.project_id 
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_metrics_update_own" ON public.project_metrics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_metrics.project_id 
      AND p.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_metrics.project_id 
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "project_metrics_delete_own" ON public.project_metrics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_metrics.project_id 
      AND p.user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at
CREATE TRIGGER update_project_metrics_updated_at
  BEFORE UPDATE ON public.project_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Function to auto-create metrics row when project is created
CREATE OR REPLACE FUNCTION public.create_project_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_metrics (project_id, started_at)
  VALUES (NEW.id, NEW.created_at);
  RETURN NEW;
END;
$$;

-- Trigger to auto-create metrics on project creation
CREATE TRIGGER create_project_metrics_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_project_metrics();

-- Function to update first_artifact_at when first artifact is created
CREATE OR REPLACE FUNCTION public.update_first_artifact_metric()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if first_artifact_at is null (first artifact)
  UPDATE public.project_metrics
  SET first_artifact_at = NEW.created_at,
      total_artifacts = total_artifacts + 1
  WHERE project_id = NEW.project_id
    AND first_artifact_at IS NULL;
  
  -- If not first artifact, just increment count
  IF NOT FOUND THEN
    UPDATE public.project_metrics
    SET total_artifacts = total_artifacts + 1
    WHERE project_id = NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for artifact creation
CREATE TRIGGER update_first_artifact_metric_trigger
  AFTER INSERT ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_first_artifact_metric();

-- Function to update first_approval_at when first artifact is approved
CREATE OR REPLACE FUNCTION public.update_first_approval_metric()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if status changed to approved and first_approval_at is null
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.project_metrics
    SET first_approval_at = NEW.approved_at
    WHERE project_id = NEW.project_id
      AND first_approval_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for artifact approval
CREATE TRIGGER update_first_approval_metric_trigger
  AFTER UPDATE ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_first_approval_metric();

-- Function to increment message count
CREATE OR REPLACE FUNCTION public.increment_message_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.project_metrics
  SET total_messages = total_messages + 1
  WHERE project_id = NEW.project_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for message creation
CREATE TRIGGER increment_message_count_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_message_count();

-- Backfill existing projects with metrics
INSERT INTO public.project_metrics (project_id, started_at, total_messages, total_artifacts)
SELECT 
  p.id,
  p.created_at,
  COALESCE((SELECT COUNT(*) FROM public.messages m WHERE m.project_id = p.id), 0),
  COALESCE((SELECT COUNT(*) FROM public.artifacts a WHERE a.project_id = p.id), 0)
FROM public.projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_metrics pm WHERE pm.project_id = p.id)
ON CONFLICT (project_id) DO NOTHING;