import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact } from "@/types/database";
import { toast } from "sonner";
import { isPreviewArtifact } from "./useArtifactParser";

interface UseArtifactManagementProps {
  userId: string | undefined;
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
}

export function useArtifactManagement({ userId, setArtifacts }: UseArtifactManagementProps) {
  // Approve an artifact - guards against approving preview artifacts
  const approveArtifact = useCallback(
    async (artifactId: string): Promise<boolean> => {
      if (!userId) return false;

      // Find the artifact first to check if it's a preview
      const artifactToApprove = await new Promise<Artifact | null>((resolve) => {
        setArtifacts((prev) => {
          const found = prev.find((a) => a.id === artifactId);
          resolve(found || null);
          return prev; // Don't modify state
        });
      });

      // Guard: Cannot approve preview artifacts
      if (!artifactToApprove) {
        console.error("[ArtifactManagement] Artifact not found:", artifactId);
        toast.error("Artifact not found");
        return false;
      }

      if (isPreviewArtifact(artifactToApprove)) {
        console.error("[ArtifactManagement] Cannot approve preview artifact:", artifactId);
        toast.error("Cannot approve a preview. Wait for it to be saved.");
        return false;
      }

      const { error } = await supabase
        .from("artifacts")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq("id", artifactId);

      if (error) {
        console.error("[ArtifactManagement] Approval error:", error);
        toast.error("Failed to approve artifact");
        return false;
      }

      setArtifacts((prev) =>
        prev.map((a) =>
          a.id === artifactId
            ? { ...a, status: "approved" as const, approved_at: new Date().toISOString() }
            : a
        )
      );

      toast.success("Artifact approved!");
      return true;
    },
    [userId, setArtifacts]
  );

  // Update artifacts from AI response (merge new artifacts into existing)
  // Replaces preview artifacts with persisted ones
  const mergeArtifacts = useCallback(
    (newArtifacts: Artifact[]) => {
      if (newArtifacts.length === 0) return;

      setArtifacts((prev) => {
        // Filter out preview artifacts first - they'll be replaced by real ones
        const withoutPreviews = prev.filter((a) => !isPreviewArtifact(a));

        // Create a new array to avoid mutation
        const updated = [...withoutPreviews];

        for (const newArtifact of newArtifacts) {
          // Skip if the new artifact is somehow a preview (shouldn't happen)
          if (isPreviewArtifact(newArtifact)) continue;

          const existingIndex = updated.findIndex((a) => a.id === newArtifact.id);
          if (existingIndex >= 0) {
            updated[existingIndex] = newArtifact;
          } else {
            // Check by artifact_type to avoid duplicates
            const typeIndex = updated.findIndex((a) => a.artifact_type === newArtifact.artifact_type);
            if (typeIndex >= 0) {
              updated[typeIndex] = newArtifact;
            } else {
              updated.push(newArtifact);
            }
          }
        }

        return updated;
      });
    },
    [setArtifacts]
  );

  // Handle realtime artifact updates - replaces previews with persisted artifacts
  const handleRealtimeArtifact = useCallback(
    (artifact: Artifact, eventType: "INSERT" | "UPDATE") => {
      setArtifacts((prev) => {
        if (eventType === "INSERT") {
          // Check if already exists by ID
          if (prev.some((a) => a.id === artifact.id && !isPreviewArtifact(a))) {
            return prev;
          }

          // Replace any preview of the same type with the real artifact
          const filteredPrev = prev.filter(
            (a) => !(isPreviewArtifact(a) && a.artifact_type === artifact.artifact_type)
          );

          // Also check if we already have this artifact by ID
          if (filteredPrev.some((a) => a.id === artifact.id)) {
            return filteredPrev;
          }

          return [...filteredPrev, artifact];
        } else {
          // UPDATE - replace by ID, also clean up any previews of same type
          return prev
            .filter((a) => !(isPreviewArtifact(a) && a.artifact_type === artifact.artifact_type))
            .map((a) => (a.id === artifact.id ? artifact : a));
        }
      });
    },
    [setArtifacts]
  );

  return {
    approveArtifact,
    mergeArtifacts,
    handleRealtimeArtifact,
  };
}