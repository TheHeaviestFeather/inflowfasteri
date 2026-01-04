import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message, Artifact } from "@/types/database";

interface UseWorkspaceRealtimeProps {
  projectId: string | undefined;
  onNewMessage: (message: Message) => void;
  onArtifactChange: (artifact: Artifact, eventType: "INSERT" | "UPDATE") => void;
}

export function useWorkspaceRealtime({
  projectId,
  onNewMessage,
  onArtifactChange,
}: UseWorkspaceRealtimeProps) {
  useEffect(() => {
    if (!projectId) return;

    // Subscribe to realtime messages
    const messagesChannel = supabase
      .channel(`messages-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          onNewMessage(newMessage);
        }
      )
      .subscribe();

    // Subscribe to realtime artifacts
    const artifactsChannel = supabase
      .channel(`artifacts-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "artifacts",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const artifact = payload.new as Artifact;
          const eventType = payload.eventType as "INSERT" | "UPDATE";
          if (eventType === "INSERT" || eventType === "UPDATE") {
            onArtifactChange(artifact, eventType);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(artifactsChannel);
    };
  }, [projectId, onNewMessage, onArtifactChange]);
}
