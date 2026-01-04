-- Add restrictive DELETE policy for artifact_versions
CREATE POLICY "artifact_versions_delete_own" ON public.artifact_versions
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = artifact_versions.project_id
    AND p.user_id = auth.uid()
  ));