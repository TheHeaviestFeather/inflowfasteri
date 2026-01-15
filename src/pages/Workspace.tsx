/**
 * Workspace page - Refactored to use WorkspaceContext
 * 
 * This component now focuses purely on layout and UI orchestration,
 * with all state management delegated to WorkspaceContext.
 */

import { useState, useCallback, useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import { useMobileView, useSwipeGesture } from "@/hooks/useMobileView";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { ArtifactCanvas } from "@/components/workspace/ArtifactCanvas";
import { EmptyProjectState } from "@/components/workspace/EmptyProjectState";
import { ConnectionStatus } from "@/components/workspace/ConnectionStatus";
import { WorkspaceSkeleton } from "@/components/workspace/WorkspaceSkeleton";
import { MobileViewTabs } from "@/components/workspace/MobileViewTabs";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

/**
 * Inner workspace component that uses the context
 */
function WorkspaceContent() {
  const { state, actions } = useWorkspace();
  const { isMobile } = useMobileView();

  // Local UI state
  const [mobileView, setMobileView] = useState<"chat" | "deliverables">("chat");
  const [hasNewDeliverable, setHasNewDeliverable] = useState(false);
  const [isArtifactPanelCollapsed, setIsArtifactPanelCollapsed] = useState(false);

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
    if (isMobile && mobileView === "chat" && state.displayArtifacts.length > 0) {
      const recentArtifact = state.displayArtifacts.find((a) => {
        const updatedAt = new Date(a.updated_at).getTime();
        const now = Date.now();
        return now - updatedAt < 10000; // Within 10 seconds
      });
      if (recentArtifact) {
        setHasNewDeliverable(true);
      }
    }
  }, [state.displayArtifacts, isMobile, mobileView]);

  // Loading state
  if (state.isAuthLoading || state.dataLoading) {
    return <WorkspaceSkeleton />;
  }

  // Empty project state
  if (state.projects.length === 0) {
    return (
      <div className="h-screen flex flex-col">
        <WorkspaceHeader
          projects={state.projects}
          currentProject={null}
          onSelectProject={actions.setCurrentProject}
          onCreateProject={actions.createProject}
          userEmail={state.user?.email}
          onSignOut={actions.signOut}
        />
        <EmptyProjectState onCreateProject={actions.createProject} />
      </div>
    );
  }

  // Shared props for ChatPanel
  const chatPanelProps = {
    messages: state.messages,
    onSendMessage: actions.handleSendMessage,
    isLoading: state.isLoading,
    messagesLoading: state.messagesLoading,
    streamingMessage: state.streamingMessage,
    error: state.error,
    parseError: state.parseError,
    onRetry: actions.handleRetryLastMessage,
    onDismissError: actions.clearError,
    onRetryParse: actions.handleRetryParse,
    onDismissParseError: actions.clearParseError,
    onClearHistory: actions.handleClearHistory,
  };

  // Shared props for ArtifactCanvas
  const artifactCanvasProps = {
    artifacts: state.displayArtifacts,
    onApprove: actions.handleApproveArtifact,
    onRetry: actions.handleRetryGeneration,
    onRegenerate: actions.handleRegenerateArtifact,
    onGenerate: actions.handleGenerateArtifact,
    onCollapsedChange: setIsArtifactPanelCollapsed,
    isStreaming: !!state.streamingMessage,
    isRegenerating: state.isLoading,
    streamingMessage: state.streamingMessage,
    mode: state.projectMode,
    currentStage: state.currentStage,
    projectName: state.currentProject?.name,
    onArtifactUpdated: actions.onArtifactUpdated,
  };

  return (
    <div className="flex flex-col h-screen w-full">
      <ConnectionStatus />

      {/* Header */}
      <WorkspaceHeader
        projects={state.projects}
        currentProject={state.currentProject}
        onSelectProject={actions.setCurrentProject}
        onCreateProject={actions.createProject}
        userEmail={state.user?.email}
        onSignOut={actions.signOut}
      />

      {/* Mobile View Tabs */}
      {isMobile && (
        <MobileViewTabs
          activeView={mobileView}
          onViewChange={handleMobileViewChange}
          hasNewDeliverable={hasNewDeliverable}
          artifactCount={state.displayArtifacts.filter((a) => a.content.length > 0).length}
        />
      )}

      {/* Main Content - Two Column Layout */}
      <div
        className="flex flex-1 min-h-0 overflow-hidden"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile ? (
          <>
            {/* Left Column: Chat Panel */}
            <div
              className={cn(
                "flex-1 min-w-0 flex flex-col bg-card border-r border-border",
                mobileView !== "chat" && "hidden"
              )}
            >
              <ErrorBoundary
                fallbackTitle="Chat Error"
                fallbackDescription="The chat panel encountered an error. Click below to recover."
              >
                <ChatPanel {...chatPanelProps} />
              </ErrorBoundary>
            </div>

            {/* Right Column: Artifact Panel */}
            <div
              className={cn(
                "min-w-0 bg-muted overflow-hidden transition-all duration-300 ease-in-out",
                mobileView === "deliverables" ? "flex-1" : "hidden"
              )}
            >
              <ErrorBoundary
                fallbackTitle="Artifacts Error"
                fallbackDescription="The artifact panel encountered an error. Click below to recover."
              >
                <ArtifactCanvas {...artifactCanvasProps} />
              </ErrorBoundary>
            </div>
          </>
        ) : (
          <ErrorBoundary
            fallbackTitle="Workspace Layout Error"
            fallbackDescription="The workspace layout encountered an error. Refresh to recover."
          >
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full w-full"
              autoSaveId="workspace-panel-layout"
            >
              <ResizablePanel defaultSize={55} minSize={30} className="min-w-0">
                <div className="h-full min-w-0 flex flex-col bg-card border-r border-border">
                  <ErrorBoundary
                    fallbackTitle="Chat Error"
                    fallbackDescription="The chat panel encountered an error. Click below to recover."
                  >
                    <ChatPanel {...chatPanelProps} />
                  </ErrorBoundary>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={45} minSize={20} className="min-w-0">
                <div
                  className={cn(
                    "h-full min-w-0 bg-muted overflow-hidden",
                    isArtifactPanelCollapsed && "flex items-stretch"
                  )}
                >
                  <ErrorBoundary
                    fallbackTitle="Artifacts Error"
                    fallbackDescription="The artifact panel encountered an error. Click below to recover."
                  >
                    <ArtifactCanvas {...artifactCanvasProps} />
                  </ErrorBoundary>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

/**
 * Workspace page with context provider wrapper
 */
export default function Workspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
    </WorkspaceProvider>
  );
}
