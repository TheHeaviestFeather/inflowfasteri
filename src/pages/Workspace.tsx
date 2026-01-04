import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useArtifactParser } from "@/hooks/useArtifactParser";
import { useSessionState } from "@/hooks/useSessionState";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
import { useArtifactManagement } from "@/hooks/useArtifactManagement";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { ArtifactCanvas } from "@/components/workspace/ArtifactCanvas";
import { EmptyProjectState } from "@/components/workspace/EmptyProjectState";
import { ConnectionStatus } from "@/components/workspace/ConnectionStatus";
import { Message, Artifact } from "@/types/database";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Workspace() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [projectMode, setProjectMode] = useState<"standard" | "quick">("standard");
  const [currentStage, setCurrentStage] = useState<string | null>(null);

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

  // Chat hook
  const { sendMessage, isLoading, streamingMessage, error, clearError, retryLastMessage } = useChat(
    currentProject?.id ?? null
  );

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

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentProject || !user) return;

      await sendMessage(content, messages, async (response) => {
        console.log("[Workspace] Processing AI response, length:", response.length);

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
          toast.error("Artifact parsing issue", {
            description:
              "The AI generated content but it couldn't be parsed. Check the chat for the full response.",
          });
        }
      });
    },
    [currentProject, user, messages, artifacts, sendMessage, processAIResponse, mergeArtifacts, processAndSaveState]
  );

  // Handle retry
  const handleRetryLastMessage = useCallback(async () => {
    if (!currentProject || !user) return;

    await retryLastMessage(messages, async (response) => {
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
    });
  }, [currentProject, user, messages, artifacts, retryLastMessage, processAIResponse, mergeArtifacts, processAndSaveState]);

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

  // Handle create project
  const handleCreateProject = useCallback(
    async (name: string, description: string) => {
      await createProject(name, description);
    },
    [createProject]
  );

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
      />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          streamingMessage={streamingMessage}
          error={error}
          onRetry={handleRetryLastMessage}
          onDismissError={clearError}
        />
        <ArtifactCanvas
          artifacts={displayArtifacts}
          onApprove={handleApproveArtifact}
          onRetry={handleRetryGeneration}
          isStreaming={!!streamingMessage}
          streamingMessage={streamingMessage}
          mode={projectMode}
          currentStage={currentStage}
          projectName={currentProject?.name}
        />
      </div>
    </div>
  );
}
