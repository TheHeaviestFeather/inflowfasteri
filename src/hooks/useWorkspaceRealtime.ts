/**
 * Hook for realtime subscriptions to workspace data
 * Uses refs for callbacks to prevent subscription churn
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message, Artifact } from "@/types/database";
import { realtimeLogger } from "@/lib/logger";

interface UseWorkspaceRealtimeProps {
  projectId: string | undefined;
  onNewMessage: (message: Message) => void;
  onArtifactChange: (artifact: Artifact, eventType: "INSERT" | "UPDATE") => void;
}

/**
 * Handles realtime subscriptions for workspace data.
 * Uses refs for callbacks to prevent subscription recreation when callbacks change.
 * @param props - Configuration for realtime subscriptions
 */
export function useWorkspaceRealtime({
  projectId,
  onNewMessage,
  onArtifactChange,
}: UseWorkspaceRealtimeProps) {
  // Use refs to store callbacks - prevents subscription recreation on callback changes
  const onNewMessageRef = useRef(onNewMessage);
  const onArtifactChangeRef = useRef(onArtifactChange);

  // Keep refs up to date
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    onArtifactChangeRef.current = onArtifactChange;
  }, [onArtifactChange]);

  // Single effect for subscriptions - only depends on projectId
  useEffect(() => {
    if (!projectId) return;

    // Sanitize projectId for channel name (remove special chars)
    const safeProjectId = projectId.replace(/[^a-zA-Z0-9-]/g, "_");

    realtimeLogger.debug("Setting up subscriptions", { projectId: safeProjectId });

    // Subscribe to realtime messages
    const messagesChannel = supabase
      .channel(`messages-${safeProjectId}`)
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
          realtimeLogger.debug("New message received", { messageId: newMessage.id });
          onNewMessageRef.current(newMessage);
        }
      )
      .subscribe((status) => {
        realtimeLogger.debug("Messages channel status", { status });
      });

    // Subscribe to realtime artifacts
    const artifactsChannel = supabase
      .channel(`artifacts-${safeProjectId}`)
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
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          if (eventType === "INSERT" || eventType === "UPDATE") {
            realtimeLogger.debug("Artifact change received", { artifactId: artifact.id, eventType });
            onArtifactChangeRef.current(artifact, eventType);
          }
        }
      )
      .subscribe((status) => {
        realtimeLogger.debug("Artifacts channel status", { status });
      });

    return () => {
      realtimeLogger.debug("Cleaning up subscriptions", { projectId: safeProjectId });
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(artifactsChannel);
    };
  }, [projectId]); // Only recreate subscriptions when projectId changes
}
