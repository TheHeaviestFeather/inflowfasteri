/**
 * Hook for workspace action handlers
 * Separates action logic from rendering for better maintainability and testability
 */

import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message, Artifact, ARTIFACT_LABELS, ArtifactType, ParseError } from "@/types/database";
import { toast } from "sonner";
import { createLogger } from "@/lib/logger";

const workspaceLogger = createLogger("WorkspaceActions");

// Re-export ParseError for backward compatibility
export type { ParseError } from "@/types/database";

interface UseWorkspaceActionsProps {
  // Current state
  currentProject: { id: string; mode?: string } | null;
  user: { id: string } | null;
  messages: Message[];
  artifacts: Artifact[];
  isLoading: boolean;
  
  // Chat functions
  sendMessage: (
    content: string,
    messages: Message[],
    onResponse: (response: string) => Promise<void>
  ) => Promise<void>;
  retryLastMessage: (
    messages: Message[],
    onResponse: (response: string) => Promise<void>
  ) => Promise<void>;
  
  // Artifact functions
  processAIResponse: (response: string, existingArtifacts: Artifact[]) => Promise<Artifact[]>;
  mergeArtifacts: (newArtifacts: Artifact[]) => void;
  approveArtifact: (artifactId: string) => Promise<boolean>;
  
  // Parser functions
  parseResponse: (response: string) => { success: boolean; response?: any };
  getSessionState: (response: any) => { mode?: string; pipeline_stage?: string } | null;
  processAndSaveState: (response: string) => Promise<any>;
  
  // State setters
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setProjectMode: (mode: "standard" | "quick") => void;
  setCurrentStage: (stage: string | null) => void;
}

interface UseWorkspaceActionsReturn {
  // Parse error state
  parseError: ParseError | null;
  lastRawResponse: string | null;
  
  // Action handlers
  handleSendMessage: (content: string) => Promise<void>;
  handleRetryLastMessage: () => Promise<void>;
  handleRetryParse: () => Promise<void>;
  handleApproveArtifact: (artifactId: string) => Promise<void>;
  handleRetryGeneration: () => Promise<void>;
  handleGenerateArtifact: (artifactType: string) => Promise<void>;
  handleRegenerateArtifact: (artifactType: string) => Promise<void>;
  handleClearHistory: () => Promise<void>;
  clearParseError: () => void;
}

export function useWorkspaceActions({
  currentProject,
  user,
  messages,
  artifacts,
  isLoading,
  sendMessage,
  retryLastMessage,
  processAIResponse,
  mergeArtifacts,
  approveArtifact,
  parseResponse,
  getSessionState,
  processAndSaveState,
  setMessages,
  setProjectMode,
  setCurrentStage,
}: UseWorkspaceActionsProps): UseWorkspaceActionsReturn {
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [lastRawResponse, setLastRawResponse] = useState<string | null>(null);

  // Clear parse error
  const clearParseError = useCallback(() => {
    setParseError(null);
  }, []);

  // Process AI response helper (shared logic)
  const processResponse = useCallback(
    async (response: string) => {
      try {
        const newArtifacts = await processAIResponse(response, artifacts);
        workspaceLogger.debug("Artifacts from response", { count: newArtifacts.length });

        if (newArtifacts.length > 0) {
          mergeArtifacts(newArtifacts);

          // Show toast for each new/updated artifact
          newArtifacts.forEach((artifact) => {
            const label = ARTIFACT_LABELS[artifact.artifact_type as ArtifactType] || artifact.artifact_type;
            const isNew = artifact.version === 1;
            toast.success(isNew ? `${label} generated` : `${label} updated`, {
              description: isNew
                ? "A new deliverable is ready for your review"
                : "The deliverable has been revised",
              duration: 4000,
            });
          });
        }

        // Extract and save session state from JSON response
        const parseResult = parseResponse(response);
        if (parseResult.success && parseResult.response) {
          const sessionState = getSessionState(parseResult.response);
          if (sessionState?.mode) {
            setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
          }
          if (sessionState?.pipeline_stage) {
            setCurrentStage(sessionState.pipeline_stage);
          }
          await processAndSaveState(response);
        }

        // Warn if response has artifact field but parsing failed
        const hasArtifactField = /\"artifact\"\s*:\s*\{/.test(response);
        if (hasArtifactField && newArtifacts.length === 0) {
          workspaceLogger.warn("Artifact field found but no artifacts parsed");
          setParseError({
            message: "The AI generated an artifact but it couldn't be parsed correctly.",
            rawContent: response,
          });
        }

        return newArtifacts;
      } catch (err) {
        workspaceLogger.error("Error processing AI response", { error: err });
        setParseError({
          message: err instanceof Error ? err.message : "Failed to parse AI response",
          rawContent: response,
        });
        return [];
      }
    },
    [artifacts, processAIResponse, mergeArtifacts, parseResponse, getSessionState, processAndSaveState, setProjectMode, setCurrentStage]
  );

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentProject || !user) return;

      clearParseError();

      await sendMessage(content, messages, async (response) => {
        workspaceLogger.debug("Processing AI response", { length: response.length });
        setLastRawResponse(response);
        await processResponse(response);
      });
    },
    [currentProject, user, messages, sendMessage, processResponse, clearParseError]
  );

  // Handle retry last message
  const handleRetryLastMessage = useCallback(async () => {
    if (!currentProject || !user) return;

    clearParseError();

    await retryLastMessage(messages, async (response) => {
      setLastRawResponse(response);
      await processResponse(response);
    });
  }, [currentProject, user, messages, retryLastMessage, processResponse, clearParseError]);

  // Handle retry parse (re-parse the last raw response)
  const handleRetryParse = useCallback(async () => {
    if (!lastRawResponse || !currentProject) return;

    clearParseError();

    try {
      const newArtifacts = await processAIResponse(lastRawResponse, artifacts);
      if (newArtifacts.length > 0) {
        mergeArtifacts(newArtifacts);

        newArtifacts.forEach((artifact) => {
          const label = ARTIFACT_LABELS[artifact.artifact_type as ArtifactType] || artifact.artifact_type;
          toast.success(`${label} recovered`, {
            description: "The deliverable was successfully parsed",
            duration: 4000,
          });
        });
      } else {
        setParseError({
          message: "No artifacts could be extracted from the response.",
          rawContent: lastRawResponse,
        });
      }
    } catch (err) {
      workspaceLogger.error("Error retrying parse", { error: err });
      setParseError({
        message: err instanceof Error ? err.message : "Failed to parse AI response",
        rawContent: lastRawResponse,
      });
    }
  }, [lastRawResponse, currentProject, artifacts, processAIResponse, mergeArtifacts, clearParseError]);

  // Handle artifact approval
  const handleApproveArtifact = useCallback(
    async (artifactId: string) => {
      const success = await approveArtifact(artifactId);
      if (success) {
        // Send APPROVE command to move to next stage
        await handleSendMessage("APPROVE");
      }
    },
    [approveArtifact, handleSendMessage]
  );

  // Handle retry generation
  const handleRetryGeneration = useCallback(async () => {
    if (!currentProject || !user || isLoading) return;
    await handleSendMessage("CONTINUE");
  }, [currentProject, user, isLoading, handleSendMessage]);

  // Handle generating a specific artifact
  const handleGenerateArtifact = useCallback(
    async (artifactType: string) => {
      if (!currentProject || !user || isLoading) return;
      const formattedType = artifactType.replace(/_/g, " ");
      await handleSendMessage(`Please generate the ${formattedType} now.`);
    },
    [currentProject, user, isLoading, handleSendMessage]
  );

  // Handle regenerate specific artifact
  const handleRegenerateArtifact = useCallback(
    async (artifactType: string) => {
      if (!currentProject || !user || isLoading) return;
      const formattedType = artifactType.replace(/_/g, " ");
      await handleSendMessage(`Please regenerate the ${formattedType} with fresh content and improvements.`);
    },
    [currentProject, user, isLoading, handleSendMessage]
  );

  // Handle clearing old message history (keep last 4 for context) - uses soft-delete
  const handleClearHistory = useCallback(async () => {
    if (!currentProject || messages.length <= 4) return;

    const messagesToDelete = messages.slice(0, -4);
    const idsToDelete = messagesToDelete.map((m) => m.id);

    // Soft delete instead of hard delete - set deleted_at timestamp
    const { error: deleteError } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", idsToDelete);

    if (deleteError) {
      workspaceLogger.error("Error soft-deleting messages", { error: deleteError });
      toast.error("Failed to clear history");
      return;
    }

    setMessages((prev) => prev.slice(-4));
    toast.success(`Cleared ${messagesToDelete.length} old messages`);
  }, [currentProject, messages, setMessages]);

  return {
    parseError,
    lastRawResponse,
    handleSendMessage,
    handleRetryLastMessage,
    handleRetryParse,
    handleApproveArtifact,
    handleRetryGeneration,
    handleGenerateArtifact,
    handleRegenerateArtifact,
    handleClearHistory,
    clearParseError,
  };
}
