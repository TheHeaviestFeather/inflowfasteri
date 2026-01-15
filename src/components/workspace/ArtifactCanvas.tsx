import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, isSkippedInQuickMode, QUICK_MODE_ARTIFACTS } from "@/types/database";
import { Check, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExportPDF } from "@/hooks/useExportPDF";
import { toast } from "sonner";
import { ArtifactActions, AIDisclaimer } from "./ArtifactActions";
import { ArtifactEditor } from "./ArtifactEditor";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { supabase } from "@/integrations/supabase/client";
import { ArtifactCardNew } from "./ArtifactCardNew";
import { formatDistanceToNow } from "date-fns";

// Import extracted components
import {
  DeliverableBanner,
  PhaseStatus,
  STAGE_TO_ARTIFACT,
  SHORT_LABELS,
} from "./artifact-canvas";
import { CollapsedArtifactSidebar } from "./artifact-canvas/CollapsedArtifactSidebar";
import { ArtifactNotificationBanner } from "./artifact-canvas/ArtifactNotificationBanner";
import { ArtifactPhaseTabs } from "./artifact-canvas/ArtifactPhaseTabs";
import { ArtifactEmptyState } from "./artifact-canvas/ArtifactEmptyState";
import { ArtifactStreamingPreview } from "./artifact-canvas/ArtifactStreamingPreview";
import { PipelineCompleteSection } from "./artifact-canvas/PipelineCompleteSection";
import { CanvasHeader } from "./artifact-canvas/CanvasHeader";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  onApprove?: (artifactId: string) => void;
  onRetry?: (artifactType: string) => void;
  onRegenerate?: (artifactType: string) => void;
  onGenerate?: (artifactType: string) => void;
  onArtifactUpdated?: (artifact: Artifact) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  isStreaming?: boolean;
  isRegenerating?: boolean;
  streamingMessage?: string | null;
  mode?: "standard" | "quick";
  currentStage?: string | null;
  projectName?: string;
}

export function ArtifactCanvas({
  artifacts,
  onApprove,
  onRetry,
  onRegenerate,
  onGenerate,
  onArtifactUpdated,
  onCollapsedChange,
  isStreaming,
  isRegenerating,
  streamingMessage,
  mode = "standard",
  currentStage,
  projectName = "Project",
}: ArtifactCanvasProps) {
  const [selectedPhase, setSelectedPhase] = useState<ArtifactType>("phase_1_contract");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [banner, setBanner] = useState<DeliverableBanner | null>(null);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const [showingHistoryFor, setShowingHistoryFor] = useState<Artifact | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const previousArtifactsRef = useRef<Map<ArtifactType, { version: number; contentLength: number; status: string }>>(new Map());
  const previousStageRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isQuickMode = mode === "quick";
  const { exportToPDF, isExporting } = useExportPDF({ projectName, mode });

  // Count approved artifacts
  const relevantArtifacts = isQuickMode ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;
  const approvedCount = relevantArtifacts.filter(type => {
    const artifact = artifacts.find(a => a.artifact_type === type);
    return artifact?.status === "approved";
  }).length;
  const hasApprovedArtifacts = approvedCount > 0;

  // Notify parent when collapsed state changes
  const handleCollapsedChange = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  }, [onCollapsedChange]);

  const handleExport = async () => {
    const result = await exportToPDF(artifacts);
    if (result.success) {
      toast.success("PDF exported successfully!", {
        description: `Saved as ${result.fileName}`,
      });
    } else {
      toast.error("Failed to export PDF");
    }
  };

  // Handle artifact save from editor
  const handleArtifactSave = useCallback((updated: Artifact) => {
    setEditingArtifactId(null);
    onArtifactUpdated?.(updated);
  }, [onArtifactUpdated]);

  // Handle version restore
  const handleRestoreVersion = useCallback(async (content: string, version: number) => {
    if (!showingHistoryFor) return;

    const currentArtifact = showingHistoryFor;

    // Insert current version into artifact_versions if not already there
    const { data: existingVersion } = await supabase
      .from("artifact_versions")
      .select("id")
      .eq("artifact_id", currentArtifact.id)
      .eq("version", currentArtifact.version)
      .maybeSingle();

    if (!existingVersion) {
      await supabase.from("artifact_versions").insert({
        artifact_id: currentArtifact.id,
        project_id: currentArtifact.project_id,
        artifact_type: currentArtifact.artifact_type,
        content: currentArtifact.content,
        version: currentArtifact.version,
      });
    }

    // Update the artifact with restored content and increment version
    const newVersion = currentArtifact.version + 1;
    const { data, error } = await supabase
      .from("artifacts")
      .update({
        content,
        version: newVersion,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentArtifact.id)
      .select()
      .single();

    if (error) throw error;

    if (data && onArtifactUpdated) {
      onArtifactUpdated(data as Artifact);
    }
  }, [showingHistoryFor, onArtifactUpdated]);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, streamingMessage]);

  // Auto-switch to current stage when it changes
  useEffect(() => {
    if (currentStage && currentStage !== previousStageRef.current) {
      const normalizedStage = currentStage.toLowerCase().replace(/\s+/g, "_");
      const artifactType = STAGE_TO_ARTIFACT[normalizedStage];

      if (artifactType) {
        if (!isQuickMode || !isSkippedInQuickMode(artifactType)) {
          setSelectedPhase(artifactType);
        }
      }
      previousStageRef.current = currentStage;
    }
  }, [currentStage, isQuickMode]);

  // Track artifact changes and show banner
  useEffect(() => {
    const currentMap = new Map<ArtifactType, { version: number; contentLength: number; status: string }>();

    artifacts.forEach((artifact) => {
      if (artifact.id.startsWith("preview-")) return;

      currentMap.set(artifact.artifact_type, {
        version: artifact.version,
        contentLength: artifact.content.length,
        status: artifact.status,
      });

      const previous = previousArtifactsRef.current.get(artifact.artifact_type);

      if (previous && previous.status === "approved" && artifact.status === "stale") {
        setBanner({
          type: artifact.artifact_type,
          isNew: false,
          isStale: true,
          timestamp: Date.now(),
        });
      } else if (!previous && artifact.content.length > 100) {
        setBanner({
          type: artifact.artifact_type,
          isNew: true,
          timestamp: Date.now(),
        });
      } else if (previous && artifact.version > previous.version && Math.abs(artifact.content.length - previous.contentLength) > 50) {
        setBanner({
          type: artifact.artifact_type,
          isNew: false,
          timestamp: Date.now(),
        });
      }
    });

    previousArtifactsRef.current = currentMap;
  }, [artifacts]);

  // Auto-dismiss banner after 4 seconds
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  const getArtifactByType = useCallback((type: ArtifactType) => {
    return artifacts.find((a) => a.artifact_type === type);
  }, [artifacts]);

  const selectedArtifact = getArtifactByType(selectedPhase);
  const isSelectedSkipped = isQuickMode && isSkippedInQuickMode(selectedPhase);

  const getPhaseStatus = useCallback((type: ArtifactType): PhaseStatus => {
    if (isQuickMode && isSkippedInQuickMode(type)) return "skipped";
    const artifact = getArtifactByType(type);
    if (artifact?.status === "approved") return "complete";
    if (artifact && artifact.content.length > 0) return "active";
    if (isQuickMode && !isSkippedInQuickMode(type)) return "pending";
    return "empty";
  }, [isQuickMode, getArtifactByType]);

  const getStatusBadge = (artifact: Artifact) => {
    switch (artifact.status) {
      case "approved":
        return (
          <Badge className="status-approved gap-1">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "stale":
        return (
          <Badge className="status-stale gap-1">
            <AlertTriangle className="h-3 w-3" />
            Needs Review
          </Badge>
        );
      case "draft":
      default:
        return (
          <Badge className="status-draft gap-1">
            <Clock className="h-3 w-3" />
            Draft
          </Badge>
        );
    }
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <CollapsedArtifactSidebar
        selectedPhase={selectedPhase}
        onSelectPhase={setSelectedPhase}
        onExpand={() => handleCollapsedChange(false)}
        getPhaseStatus={getPhaseStatus}
        getArtifactByType={getArtifactByType}
      />
    );
  }

  // Version history panel
  if (showingHistoryFor) {
    return (
      <VersionHistoryPanel
        artifact={showingHistoryFor}
        onClose={() => setShowingHistoryFor(null)}
        onRestore={handleRestoreVersion}
      />
    );
  }

  return (
    <div className="h-full w-full bg-card border-l flex flex-col min-h-0 overflow-hidden">
      {/* Notification Banner */}
      {banner && (
        <ArtifactNotificationBanner
          banner={banner}
          onDismiss={() => setBanner(null)}
        />
      )}

      {/* Canvas Header with Phase Tabs */}
      <div className="border-b">
        <CanvasHeader
          isQuickMode={isQuickMode}
          approvedCount={approvedCount}
          hasApprovedArtifacts={hasApprovedArtifacts}
          isExporting={isExporting}
          onExport={handleExport}
          onCollapse={() => handleCollapsedChange(true)}
        />

        <ArtifactPhaseTabs
          selectedPhase={selectedPhase}
          onSelectPhase={setSelectedPhase}
          isQuickMode={isQuickMode}
          artifacts={artifacts}
          getPhaseStatus={getPhaseStatus}
          getArtifactByType={getArtifactByType}
        />
      </div>

      {/* Canvas Content */}
      <ScrollArea className="flex-1 min-h-0 w-full" ref={scrollRef}>
        <div className="p-4 max-w-full overflow-hidden">
          {isSelectedSkipped || !selectedArtifact?.content ? (
            // Empty or skipped state - OR streaming preview
            isStreaming && streamingMessage ? (
              <ArtifactStreamingPreview
                selectedPhase={selectedPhase}
                streamingMessage={streamingMessage}
              />
            ) : (
              <ArtifactEmptyState
                selectedPhase={selectedPhase}
                isQuickMode={isQuickMode}
                isStreaming={!!isStreaming}
                isRegenerating={!!isRegenerating}
                currentStage={currentStage ?? null}
                onSelectPhase={setSelectedPhase}
                onGenerate={onGenerate}
                onRetry={onRetry}
                getArtifactByType={getArtifactByType}
              />
            )
          ) : (
            // Artifact content view
            <div className="space-y-4">
              {editingArtifactId === selectedArtifact.id ? (
                <ArtifactEditor
                  artifact={selectedArtifact}
                  onSave={handleArtifactSave}
                  onCancel={() => setEditingArtifactId(null)}
                />
              ) : (
                <>
                  <ArtifactCardNew
                    title={`Phase ${ARTIFACT_ORDER.indexOf(selectedArtifact.artifact_type as ArtifactType) + 1}: ${ARTIFACT_LABELS[selectedArtifact.artifact_type as ArtifactType]}`}
                    status={selectedArtifact.status as "approved" | "stale" | "draft"}
                    version={selectedArtifact.version}
                    modifiedAgo={formatDistanceToNow(new Date(selectedArtifact.updated_at), { addSuffix: true })}
                    content={selectedArtifact.content}
                    artifactType={selectedArtifact.artifact_type as ArtifactType}
                    onEdit={!selectedArtifact.id.startsWith("preview-") && !isStreaming ? () => setEditingArtifactId(selectedArtifact.id) : undefined}
                    onCopy={() => {
                      navigator.clipboard.writeText(selectedArtifact.content);
                      toast.success("Content copied to clipboard");
                    }}
                    onShare={() => {
                      toast.info("Share functionality coming soon");
                    }}
                  />
                  <AIDisclaimer />

                  {!selectedArtifact.id.startsWith("preview-") && !isStreaming && (
                    <div className="flex items-center gap-2 pt-2">
                      <ArtifactActions
                        artifact={selectedArtifact}
                        onEdit={() => setEditingArtifactId(selectedArtifact.id)}
                        onRegenerate={onRegenerate ? () => onRegenerate(selectedArtifact.artifact_type) : undefined}
                        isRegenerating={isRegenerating}
                        onShowHistory={() => setShowingHistoryFor(selectedArtifact)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pipeline Complete State */}
      <PipelineCompleteSection
        isQuickMode={isQuickMode}
        artifacts={artifacts}
        isExporting={isExporting}
        onExport={handleExport}
        getArtifactByType={getArtifactByType}
      />

      {/* Approve Button */}
      {selectedArtifact?.content && (selectedArtifact.status === "draft" || selectedArtifact.status === "stale") && onApprove && !selectedArtifact.id.startsWith("preview-") && !isSelectedSkipped && (
        <div className="p-4 border-t">
          <Button
            onClick={async () => {
              setIsApproving(true);
              try {
                await onApprove(selectedArtifact.id);
              } finally {
                setIsApproving(false);
              }
            }}
            className="w-full gap-2"
            disabled={isStreaming || isApproving}
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isApproving ? "Approving..." : `Approve ${SHORT_LABELS[selectedPhase]}`}
          </Button>
        </div>
      )}
    </div>
  );
}
