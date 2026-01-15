import { memo, ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  isMobile: boolean;
  mobileView: "chat" | "deliverables";
  isArtifactPanelCollapsed: boolean;
  chatPanel: ReactNode;
  artifactPanel: ReactNode;
  swipeHandlers?: Record<string, unknown>;
}

const ChatPanelWrapper = memo(function ChatPanelWrapper({
  children,
  isMobile,
  mobileView,
}: {
  children: ReactNode;
  isMobile: boolean;
  mobileView: "chat" | "deliverables";
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 flex flex-col bg-card border-r border-border",
        isMobile && mobileView !== "chat" && "hidden"
      )}
    >
      <ErrorBoundary
        fallbackTitle="Chat Error"
        fallbackDescription="The chat panel encountered an error. Click below to recover."
      >
        {children}
      </ErrorBoundary>
    </div>
  );
});

const ArtifactPanelWrapper = memo(function ArtifactPanelWrapper({
  children,
  isMobile,
  mobileView,
  isCollapsed,
}: {
  children: ReactNode;
  isMobile: boolean;
  mobileView: "chat" | "deliverables";
  isCollapsed: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 bg-muted overflow-hidden transition-all duration-300 ease-in-out",
        isMobile ? (mobileView === "deliverables" ? "flex-1" : "hidden") : "",
        !isMobile && isCollapsed && "flex items-stretch"
      )}
    >
      <ErrorBoundary
        fallbackTitle="Artifacts Error"
        fallbackDescription="The artifact panel encountered an error. Click below to recover."
      >
        {children}
      </ErrorBoundary>
    </div>
  );
});

export const WorkspaceLayout = memo(function WorkspaceLayout({
  isMobile,
  mobileView,
  isArtifactPanelCollapsed,
  chatPanel,
  artifactPanel,
  swipeHandlers = {},
}: WorkspaceLayoutProps) {
  if (isMobile) {
    return (
      <div
        className="flex flex-1 min-h-0 overflow-hidden"
        {...swipeHandlers}
      >
        <ChatPanelWrapper isMobile={isMobile} mobileView={mobileView}>
          {chatPanel}
        </ChatPanelWrapper>

        <ArtifactPanelWrapper
          isMobile={isMobile}
          mobileView={mobileView}
          isCollapsed={isArtifactPanelCollapsed}
        >
          {artifactPanel}
        </ArtifactPanelWrapper>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
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
                {chatPanel}
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
                {artifactPanel}
              </ErrorBoundary>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ErrorBoundary>
    </div>
  );
});
