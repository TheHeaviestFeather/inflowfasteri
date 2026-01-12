/**
 * Hook for managing artifact operations
 * Handles approval, merging, and realtime updates
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact, ArtifactType, ARTIFACT_ORDER, QUICK_MODE_ARTIFACTS } from "@/types/database";
import { toast } from "sonner";
import { isPreviewArtifact } from "./useArtifactParserV2";
import { artifactLogger } from "@/lib/logger";

interface UseArtifactManagementProps {
  userId: string | undefined;
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
  mode?: "standard" | "quick";
}

/**
 * Hook for artifact management operations
 * @param props - Configuration with userId, artifact setter, and project mode
 */
export function useArtifactManagement({ userId, setArtifacts, mode = "standard" }: UseArtifactManagementProps) {
  /**
   * Get the artifact order based on project mode
   */
  const getArtifactOrder = useCallback((): ArtifactType[] => {
    return mode === "quick" ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;
  }, [mode]);

  /**
   * Approve an artifact - cascades approval to all preceding phases
   * If approving phase N, phases 1 to N-1 are also auto-approved
   */
  const approveArtifact = useCallback(
    async (artifactId: string): Promise<boolean> => {
      if (!userId) return false;

      // Get all current artifacts to determine cascade
      const allArtifacts = await new Promise<Artifact[]>((resolve) => {
        setArtifacts((prev) => {
          resolve([...prev]);
          return prev;
        });
      });

      const artifactToApprove = allArtifacts.find((a) => a.id === artifactId);

      // Guard: Cannot approve preview artifacts
      if (!artifactToApprove) {
        artifactLogger.error("Artifact not found:", { artifactId });
        toast.error("Artifact not found");
        return false;
      }

      if (isPreviewArtifact(artifactToApprove)) {
        artifactLogger.error("Cannot approve preview artifact:", { artifactId });
        toast.error("Cannot approve a preview. Wait for it to be saved.");
        return false;
      }

      const artifactOrder = getArtifactOrder();
      const approvedTypeIndex = artifactOrder.indexOf(artifactToApprove.artifact_type);
      const approvalTime = new Date().toISOString();
      
      // If artifact type is not in the current mode's order, just approve this one
      if (approvedTypeIndex === -1) {
        // OPTIMISTIC UPDATE - Update UI immediately
        const previousState = [...allArtifacts];
        setArtifacts((prev) =>
          prev.map((a) =>
            a.id === artifactId
              ? { ...a, status: "approved" as const, approved_at: approvalTime }
              : a
          )
        );

        const { error } = await supabase
          .from("artifacts")
          .update({
            status: "approved",
            approved_at: approvalTime,
            approved_by: userId,
          })
          .eq("id", artifactId);

        if (error) {
          // ROLLBACK on failure
          artifactLogger.error("Approval error, rolling back:", { error });
          setArtifacts(previousState);
          toast.error("Failed to approve. Please try again.");
          return false;
        }

        toast.success("Artifact approved!");
        return true;
      }
      
      // Collect all artifacts that need approval (this one + all preceding unapproved ones)
      const artifactsToApprove: Artifact[] = [];
      
      for (let i = 0; i <= approvedTypeIndex; i++) {
        const type = artifactOrder[i];
        const artifact = allArtifacts.find(
          (a) => a.artifact_type === type && !isPreviewArtifact(a)
        );
        // Only include if it exists, has content, and is not already approved
        if (artifact && artifact.content.length > 0 && artifact.status !== "approved") {
          artifactsToApprove.push(artifact);
        }
      }

      if (artifactsToApprove.length === 0) {
        toast.info("Already approved");
        return true;
      }

      const idsToApprove = artifactsToApprove.map((a) => a.id);

      // OPTIMISTIC UPDATE - Update UI immediately
      const previousState = [...allArtifacts];
      setArtifacts((prev) =>
        prev.map((a) =>
          idsToApprove.includes(a.id)
            ? { ...a, status: "approved" as const, approved_at: approvalTime }
            : a
        )
      );

      // Batch update all artifacts that need approval
      const { error } = await supabase
        .from("artifacts")
        .update({
          status: "approved",
          approved_at: approvalTime,
          approved_by: userId,
        })
        .in("id", idsToApprove);

      if (error) {
        // ROLLBACK on failure
        artifactLogger.error("Approval error, rolling back:", { error });
        setArtifacts(previousState);
        toast.error("Failed to approve. Please try again.");
        return false;
      }

      const count = artifactsToApprove.length;
      if (count === 1) {
        toast.success("Artifact approved!");
      } else {
        toast.success(`Approved ${count} artifacts`, {
          description: "Previous phases were auto-approved",
        });
      }
      return true;
    },
    [userId, setArtifacts, getArtifactOrder]
  );

  /**
   * Update artifacts from AI response (merge new artifacts into existing)
   * Replaces preview artifacts with persisted ones
   */
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

  /**
   * Handle realtime artifact updates - replaces previews with persisted artifacts
   * Guards against downgrading approved status from stale updates
   */
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
          // Guard: Never downgrade from "approved" to "draft" via realtime
          return prev
            .filter((a) => !(isPreviewArtifact(a) && a.artifact_type === artifact.artifact_type))
            .map((a) => {
              if (a.id === artifact.id) {
                // If local state is approved but incoming is draft, keep approved
                if (a.status === "approved" && artifact.status === "draft") {
                  return a;
                }
                return artifact;
              }
              return a;
            });
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
