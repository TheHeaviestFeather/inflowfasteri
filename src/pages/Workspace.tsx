import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import { useArtifactParser } from "@/hooks/useArtifactParser";
import { useSessionState } from "@/hooks/useSessionState";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
import { useArtifactManagement } from "@/hooks/useArtifactManagement";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { ArtifactCanvas } from "@/components/workspace/ArtifactCanvas";
import { EmptyProjectState } from "@/components/workspace/EmptyProjectState";
import { ConnectionStatus } from "@/components/workspace/ConnectionStatus";
import { WorkspaceSkeleton } from "@/components/workspace/WorkspaceSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Message, Artifact } from "@/types/database";
import { toast } from "sonner";

interface ParseError {
  message: string;
  rawContent?: string;
}

export default function Workspace() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [projectMode, setProjectMode] = useState<"standard" | "quick">("standard");
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [lastRawResponse, setLastRawResponse] = useState<string | null>(null);

  // Data management hooks
  const {
    projects,
    currentProject,
    messages,
    artifacts,
    dataLoading,
    setCurrentProject,
    setMessages,
    setArtifacts,
    createProject,
  } = useWorkspaceData({ userId: user?.id });

  // Chat hook with reconnect handler
  const { 
    sendMessage, 
    isLoading, 
    streamingMessage, 
    error, 
    clearError, 
    retryLastMessage,
    handleReconnect,
  } = useChat(currentProject?.id ?? null);

  // Online status with auto-retry on reconnect
  useOnlineStatus({ onReconnect: handleReconnect });

  // Artifact parsing
  const { processAIResponse, getStreamingArtifactPreview } = useArtifactParser(
    currentProject?.id ?? null
  );

  // Session state
  const { processAndSaveState, loadSessionState } = useSessionState(currentProject?.id ?? null);

  // Artifact management
  const { approveArtifact, mergeArtifacts, handleRealtimeArtifact } = useArtifactManagement({
    userId: user?.id,
    setArtifacts,
  });

  // Realtime message handler
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    },
    [setMessages]
  );

  // Set up realtime subscriptions
  useWorkspaceRealtime({
    projectId: currentProject?.id,
    onNewMessage: handleNewMessage,
    onArtifactChange: handleRealtimeArtifact,
  });

  // Compute live artifact preview during streaming
  const displayArtifacts = useMemo(() => {
    if (streamingMessage && streamingMessage.length > 50) {
      const preview = getStreamingArtifactPreview(streamingMessage, artifacts);
      if (preview.length >= artifacts.length) {
        return preview;
      }
    }
    return artifacts;
  }, [streamingMessage, artifacts, getStreamingArtifactPreview]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Load session state when project changes
  useEffect(() => {
    if (!currentProject) return;

    const loadState = async () => {
      const sessionState = await loadSessionState();
      if (sessionState?.mode) {
        setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
      } else {
        setProjectMode((currentProject.mode as "standard" | "quick") || "standard");
      }
      if (sessionState?.pipeline_stage) {
        setCurrentStage(sessionState.pipeline_stage);
      }
    };

    loadState();
  }, [currentProject?.id, loadSessionState]);

  // Clear parse error when starting new message
  const clearParseError = useCallback(() => {
    setParseError(null);
  }, []);

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentProject || !user) return;

      // Clear any previous parse error
      clearParseError();

      await sendMessage(content, messages, async (response) => {
        console.log("[Workspace] Processing AI response, length:", response.length);
        setLastRawResponse(response);

        try {
          // Process AI response for artifacts
          const newArtifacts = await processAIResponse(response, artifacts);
          console.log("[Workspace] New artifacts from response:", newArtifacts.length);

          if (newArtifacts.length > 0) {
            mergeArtifacts(newArtifacts);
          }

          // Process and save session state
          const sessionState = await processAndSaveState(response);
          if (sessionState?.mode) {
            setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
          }
          if (sessionState?.pipeline_stage) {
            setCurrentStage(sessionState.pipeline_stage);
          }

          // Warn if AI mentioned deliverable but no artifacts parsed
          const mentionsDeliverable =
            /\*\*DELIVERABLE:/i.test(response) ||
            /#{2,3}\s*(Phase\s*\d*:?\s*)?(Contract|Discovery|Learner|Design|Scenario|Assessment|Final|Performance)/i.test(
              response
            );

          if (mentionsDeliverable && newArtifacts.length === 0) {
            console.warn("[Workspace] Deliverable mentioned but no artifacts parsed");
            setParseError({
              message: "The AI generated content but it couldn't be parsed as an artifact.",
              rawContent: response,
            });
          }
        } catch (err) {
          console.error("[Workspace] Error processing AI response:", err);
          setParseError({
            message: err instanceof Error ? err.message : "Failed to parse AI response",
            rawContent: response,
          });
        }
      });
    },
    [currentProject, user, messages, artifacts, sendMessage, processAIResponse, mergeArtifacts, processAndSaveState, clearParseError]
  );

  // Handle retry last message
  const handleRetryLastMessage = useCallback(async () => {
    if (!currentProject || !user) return;

    clearParseError();

    await retryLastMessage(messages, async (response) => {
      setLastRawResponse(response);

      try {
        const newArtifacts = await processAIResponse(response, artifacts);
        if (newArtifacts.length > 0) {
          mergeArtifacts(newArtifacts);
        }

        const sessionState = await processAndSaveState(response);
        if (sessionState?.mode) {
          setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
        }
        if (sessionState?.pipeline_stage) {
          setCurrentStage(sessionState.pipeline_stage);
        }
      } catch (err) {
        console.error("[Workspace] Error processing retry response:", err);
        setParseError({
          message: err instanceof Error ? err.message : "Failed to parse AI response",
          rawContent: response,
        });
      }
    });
  }, [currentProject, user, messages, artifacts, retryLastMessage, processAIResponse, mergeArtifacts, processAndSaveState, clearParseError]);

  // Handle retry parse (re-parse the last raw response)
  const handleRetryParse = useCallback(async () => {
    if (!lastRawResponse || !currentProject) return;

    clearParseError();

    try {
      const newArtifacts = await processAIResponse(lastRawResponse, artifacts);
      if (newArtifacts.length > 0) {
        mergeArtifacts(newArtifacts);
        toast.success("Artifacts parsed successfully");
      } else {
        setParseError({
          message: "No artifacts could be extracted from the response.",
          rawContent: lastRawResponse,
        });
      }
    } catch (err) {
      console.error("[Workspace] Error retrying parse:", err);
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

  // Handle regenerate specific artifact
  const handleRegenerateArtifact = useCallback(async (artifactType: string) => {
    if (!currentProject || !user || isLoading) return;
    const formattedType = artifactType.replace(/_/g, " ");
    await handleSendMessage(`Please regenerate the ${formattedType} with fresh content and improvements.`);
  }, [currentProject, user, isLoading, handleSendMessage]);

  // Handle clearing old message history (keep last 4 for context)
  const handleClearHistory = useCallback(async () => {
    if (!currentProject || messages.length <= 4) return;

    const messagesToDelete = messages.slice(0, -4);
    const idsToDelete = messagesToDelete.map((m) => m.id);

    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("[Workspace] Error deleting messages:", deleteError);
      toast.error("Failed to clear history");
      return;
    }

    setMessages((prev) => prev.slice(-4));
    toast.success(`Cleared ${messagesToDelete.length} old messages`);
  }, [currentProject, messages, setMessages]);

  // Handle create project
  const handleCreateProject = useCallback(
    async (name: string, description: string) => {
      await createProject(name, description);
    },
    [createProject]
  );

  if (authLoading || dataLoading) {
    return <WorkspaceSkeleton />;
  }

  // Show empty project state when no projects exist
  if (projects.length === 0) {
    return (
      <div className="h-screen flex flex-col">
        <WorkspaceHeader
          projects={projects}
          currentProject={null}
          onSelectProject={setCurrentProject}
          onCreateProject={handleCreateProject}
          userEmail={user?.email}
          onSignOut={signOut}
        />
        <EmptyProjectState onCreateProject={handleCreateProject} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <ConnectionStatus />
      <WorkspaceHeader
        projects={projects}
        currentProject={currentProject}
        onSelectProject={setCurrentProject}
        onCreateProject={handleCreateProject}
        userEmail={user?.email}
        onSignOut={signOut}
        artifacts={artifacts}
        currentStage={currentStage}
        mode={projectMode}
      />
      <div className="flex-1 flex overflow-hidden">
        <ErrorBoundary
          fallbackTitle="Chat Error"
          fallbackDescription="The chat panel encountered an error. Click below to recover."
        >
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            streamingMessage={streamingMessage}
            error={error}
            parseError={parseError}
            onRetry={handleRetryLastMessage}
            onDismissError={clearError}
            onRetryParse={handleRetryParse}
            onDismissParseError={clearParseError}
            onClearHistory={handleClearHistory}
          />
        </ErrorBoundary>
        <ErrorBoundary
          fallbackTitle="Artifacts Error"
          fallbackDescription="The artifact panel encountered an error. Click below to recover."
        >
          <ArtifactCanvas
            artifacts={displayArtifacts}
            onApprove={handleApproveArtifact}
            onRetry={handleRetryGeneration}
            onRegenerate={handleRegenerateArtifact}
            isStreaming={!!streamingMessage}
            isRegenerating={isLoading}
            streamingMessage={streamingMessage}
            mode={projectMode}
            currentStage={currentStage}
            projectName={currentProject?.name}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
