/**
 * Inline artifact editor with save/cancel
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact } from "@/types/database";
import { toast } from "sonner";

interface ArtifactEditorProps {
  artifact: Artifact;
  onSave: (updated: Artifact) => void;
  onCancel: () => void;
}

export function ArtifactEditor({ artifact, onSave, onCancel }: ArtifactEditorProps) {
  const [content, setContent] = useState(artifact.content);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setHasChanges(value !== artifact.content);
  }, [artifact.content]);

  const handleSave = async () => {
    if (!hasChanges) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("artifacts")
        .update({
          content,
          status: "draft", // Reset to draft when edited
          updated_at: new Date().toISOString(),
          version: artifact.version + 1,
        })
        .eq("id", artifact.id)
        .select()
        .single();

      if (error) throw error;

      toast.success("Changes saved");
      onSave(data as Artifact);
    } catch (err) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    onCancel();
  };

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md text-sm">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="text-amber-700 dark:text-amber-400">
          Editing will reset approval status. Your changes will be saved as a new draft.
        </span>
      </div>

      {/* Editor */}
      <Textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-[400px] font-mono text-sm"
        placeholder="Enter artifact content..."
      />

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
