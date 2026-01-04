import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact } from "@/types/database";
import { toast } from "sonner";

interface UseArtifactManagementProps {
  userId: string | undefined;
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
}

export function useArtifactManagement({ userId, setArtifacts }: UseArtifactManagementProps) {
  // Approve an artifact
  const approveArtifact = useCallback(
    async (artifactId: string): Promise<boolean> => {
      if (!userId) return false;

      const { error } = await supabase
        .from("artifacts")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq("id", artifactId);

      if (error) {
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
  const mergeArtifacts = useCallback(
    (newArtifacts: Artifact[]) => {
      if (newArtifacts.length === 0) return;

      setArtifacts((prev) => {
        // Create a new array to avoid mutation
        const updated = [...prev];
        
        for (const newArtifact of newArtifacts) {
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

  // Handle realtime artifact updates
  const handleRealtimeArtifact = useCallback(
    (artifact: Artifact, eventType: "INSERT" | "UPDATE") => {
      setArtifacts((prev) => {
        if (eventType === "INSERT") {
          // Check if already exists
          if (prev.some((a) => a.id === artifact.id)) return prev;
          return [...prev, artifact];
        } else {
          // UPDATE
          return prev.map((a) => (a.id === artifact.id ? artifact : a));
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
