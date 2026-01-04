-- Drop and recreate the view with SECURITY INVOKER (the default, but explicit is better)
DROP VIEW IF EXISTS projects_with_stats;

CREATE VIEW projects_with_stats 
WITH (security_invoker = true)
AS
SELECT 
  p.*,
  COALESCE((SELECT COUNT(*) FROM messages m WHERE m.project_id = p.id), 0)::int as message_count,
  COALESCE((SELECT COUNT(*) FROM artifacts a WHERE a.project_id = p.id), 0)::int as artifact_count
FROM projects p;

-- Re-grant access
GRANT SELECT ON projects_with_stats TO authenticated;