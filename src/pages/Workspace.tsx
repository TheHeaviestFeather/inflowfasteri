import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useArtifactParserV2 } from "@/hooks/useArtifactParserV2";
import { useSessionState } from "@/hooks/useSessionState";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
import { useArtifactManagement } from "@/hooks/useArtifactManagement";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMobileView, useSwipeGesture } from "@/hooks/useMobileView";
import { useWorkspaceActions } from "@/hooks/useWorkspaceActions";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { ArtifactCanvas } from "@/components/workspace/ArtifactCanvas";
import { EmptyProjectState } from "@/components/workspace/EmptyProjectState";
import { ConnectionStatus } from "@/components/workspace/ConnectionStatus";
import { WorkspaceSkeleton } from "@/components/workspace/WorkspaceSkeleton";
import { MobileViewTabs } from "@/components/workspace/MobileViewTabs";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Message } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Workspace() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useMobileView();

  // Project state
  const [projectMode, setProjectMode] = useState<"standard" | "quick">("standard");
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "deliverables">("chat");
  const [hasNewDeliverable, setHasNewDeliverable] = useState(false);
  const [isArtifactPanelCollapsed, setIsArtifactPanelCollapsed] = useState(false);

  // Data management hooks
  const {
    projects,
    currentProject,
    messages,
    artifacts,
    dataLoading,
    messagesLoading,
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

  // Artifact parsing - using V2 with JSON schema
  const { processAIResponse, getStreamingArtifactPreview, getSessionState, parseResponse } =
    useArtifactParserV2(currentProject?.id ?? null);

  // Session state
  const { processAndSaveState, loadSessionState } = useSessionState(currentProject?.id ?? null);

  // Artifact management with cascading approval
  const { approveArtifact, mergeArtifacts, handleRealtimeArtifact } = useArtifactManagement({
    userId: user?.id,
    setArtifacts,
    mode: projectMode,
  });

  // Action handlers - extracted for maintainability
  const {
    parseError,
    handleSendMessage,
    handleRetryLastMessage,
    handleRetryParse,
    handleApproveArtifact,
    handleRetryGeneration,
    handleGenerateArtifact,
    handleRegenerateArtifact,
    handleClearHistory,
    clearParseError,
  } = useWorkspaceActions({
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

  // Handle create project
  const handleCreateProject = useCallback(
    async (name: string, description: string) => {
      await createProject(name, description);
    },
    [createProject]
  );

  // Handle mobile view change with notification reset
  const handleMobileViewChange = useCallback((view: "chat" | "deliverables") => {
    setMobileView(view);
    if (view === "deliverables") {
      setHasNewDeliverable(false);
    }
  }, []);

  // Swipe gesture handlers for mobile navigation
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      if (isMobile && mobileView === "chat") {
        handleMobileViewChange("deliverables");
      }
    },
    onSwipeRight: () => {
      if (isMobile && mobileView === "deliverables") {
        handleMobileViewChange("chat");
      }
    },
    threshold: 75,
  });

  // Notify when new deliverable arrives while on chat view (mobile)
  useEffect(() => {
    if (isMobile && mobileView === "chat" && displayArtifacts.length > 0) {
      const recentArtifact = displayArtifacts.find((a) => {
        const updatedAt = new Date(a.updated_at).getTime();
        const now = Date.now();
        return now - updatedAt < 10000; // Within 10 seconds
      });
      if (recentArtifact) {
        setHasNewDeliverable(true);
      }
    }
  }, [displayArtifacts, isMobile, mobileView]);

  // Loading state
  if (authLoading || dataLoading) {
    return <WorkspaceSkeleton />;
  }

  // Empty project state
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

  console.log("[Workspace] Rendering - projects:", projects.length, "currentProject:", currentProject?.id);
  
  return (
    <div className="flex flex-col h-screen w-full">
      <ConnectionStatus />
      
      {/* Header - h-16 sticky */}
      <WorkspaceHeader
        projects={projects}
        currentProject={currentProject}
        onSelectProject={setCurrentProject}
        onCreateProject={handleCreateProject}
        userEmail={user?.email}
        onSignOut={signOut}
      />

      {/* Mobile View Tabs */}
      {isMobile && (
        <MobileViewTabs
          activeView={mobileView}
          onViewChange={handleMobileViewChange}
          hasNewDeliverable={hasNewDeliverable}
          artifactCount={displayArtifacts.filter((a) => a.content.length > 0).length}
        />
      )}

      {/* Main Content - Two Column Layout */}
      <div 
        className="flex flex-1 min-h-0 overflow-hidden"
        {...(isMobile ? swipeHandlers : {})}
      >
        {/* Left Column: Chat Panel */}
        <div className={cn(
          "flex-1 min-w-0 flex flex-col bg-white border-r border-slate-200",
          isMobile && mobileView !== "chat" && "hidden"
        )}>
          <ErrorBoundary
            fallbackTitle="Chat Error"
            fallbackDescription="The chat panel encountered an error. Click below to recover."
          >
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              messagesLoading={messagesLoading}
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
        </div>

        {/* Right Column: Artifact Panel */}
        <div
          className={cn(
            "min-w-0 bg-slate-50 overflow-hidden transition-all duration-300 ease-in-out",
            isMobile 
              ? (mobileView === "deliverables" ? "flex-1" : "hidden") 
              : isArtifactPanelCollapsed 
                ? "w-16 flex-shrink-0" 
                : "flex-1"
          )}
        >
          <ErrorBoundary
            fallbackTitle="Artifacts Error"
            fallbackDescription="The artifact panel encountered an error. Click below to recover."
          >
            <ArtifactCanvas
              artifacts={displayArtifacts}
              onApprove={handleApproveArtifact}
              onRetry={handleRetryGeneration}
              onRegenerate={handleRegenerateArtifact}
              onGenerate={handleGenerateArtifact}
              onCollapsedChange={setIsArtifactPanelCollapsed}
              isStreaming={!!streamingMessage}
              isRegenerating={isLoading}
              streamingMessage={streamingMessage}
              mode={projectMode}
              currentStage={currentStage}
              projectName={currentProject?.name}
              onArtifactUpdated={(artifact) => {
                setArtifacts((prev) => prev.map((a) => (a.id === artifact.id ? artifact : a)));
              }}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
