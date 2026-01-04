-- Fix Critical Issue #2: Create trigger for automatic version history
-- This ensures version history is always created atomically with artifact updates

CREATE OR REPLACE FUNCTION public.create_artifact_version_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if content actually changed
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO public.artifact_versions (
      artifact_id,
      project_id,
      artifact_type,
      content,
      version
    ) VALUES (
      OLD.id,
      OLD.project_id,
      OLD.artifact_type,
      OLD.content,
      OLD.version
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on artifacts table
DROP TRIGGER IF EXISTS artifact_version_trigger ON public.artifacts;
CREATE TRIGGER artifact_version_trigger
  BEFORE UPDATE ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_artifact_version_on_update();