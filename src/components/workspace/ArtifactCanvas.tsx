import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, ARTIFACT_SHORT_LABELS, STAGE_TO_ARTIFACT, isSkippedInQuickMode, QUICK_MODE_ARTIFACTS } from "@/types/database";
import { Check, Clock, AlertTriangle, FileText, ChevronLeft, ChevronRight, SkipForward, Sparkles, X, RotateCcw, Download, Loader2, Pencil, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { useExportPDF } from "@/hooks/useExportPDF";
import { toast } from "sonner";
import { ArtifactActions, AIDisclaimer } from "./ArtifactActions";
import { ArtifactEditor } from "./ArtifactEditor";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { supabase } from "@/integrations/supabase/client";
import { ArtifactCardNew } from "./ArtifactCardNew";
import { ArtifactStreamingPreview } from "./ArtifactStreamingPreview";
import { formatDistanceToNow } from "date-fns";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  onApprove?: (artifactId: string) => void;
  onRetry?: () => void;
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

interface DeliverableBanner {
  type: ArtifactType;
  isNew: boolean;
  timestamp: number;
}

export function ArtifactCanvas({ artifacts, onApprove, onRetry, onRegenerate, onGenerate, onArtifactUpdated, onCollapsedChange, isStreaming, isRegenerating, streamingMessage, mode = "standard", currentStage, projectName = "Project" }: ArtifactCanvasProps) {
  const [selectedPhase, setSelectedPhase] = useState<ArtifactType>("phase_1_contract");
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Notify parent when collapsed state changes
  const handleCollapsedChange = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  }, [onCollapsedChange]);
  const [banner, setBanner] = useState<DeliverableBanner | null>(null);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const [showingHistoryFor, setShowingHistoryFor] = useState<Artifact | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShownEditHint, setHasShownEditHint] = useState(false);
  const previousArtifactsRef = useRef<Map<ArtifactType, { version: number; contentLength: number }>>(new Map());
  const previousStageRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isQuickMode = mode === "quick";
  const { exportToPDF, isExporting } = useExportPDF({ projectName, mode });

  // Memoize relevant artifacts based on mode
  const relevantArtifacts = useMemo(
    () => (isQuickMode ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER),
    [isQuickMode]
  );

  // Memoize approved count to avoid recalculation on every render
  const approvedCount = useMemo(() => {
    return relevantArtifacts.filter((type) => {
      const artifact = artifacts.find((a) => a.artifact_type === type);
      return artifact?.status === "approved";
    }).length;
  }, [relevantArtifacts, artifacts]);

  const hasApprovedArtifacts = approvedCount > 0;

  // Memoized export handler
  const handleExport = useCallback(async () => {
    const result = await exportToPDF(artifacts);
    if (result.success) {
      toast.success("PDF exported successfully!", {
        description: `Saved as ${result.fileName}`,
      });
    } else {
      toast.error("Failed to export PDF");
    }
  }, [exportToPDF, artifacts]);

  // Export single artifact as markdown
  const handleExportMarkdown = useCallback((artifact: Artifact) => {
    const blob = new Blob([artifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.artifact_type}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown exported", { description: `${ARTIFACT_LABELS[artifact.artifact_type]}.md` });
  }, []);

  // Handle artifact save from editor
  const handleArtifactSave = useCallback((updated: Artifact) => {
    setEditingArtifactId(null);
    onArtifactUpdated?.(updated);
  }, [onArtifactUpdated]);

  // Memoized handlers for common operations
  const handleCancelEdit = useCallback(() => setEditingArtifactId(null), []);
  const handleDismissBanner = useCallback(() => setBanner(null), []);
  const handleShowCelebration = useCallback(() => setShowCelebration(true), []);
  const handleHideCelebration = useCallback(() => setShowCelebration(false), []);

  // Handle version restore
  const handleRestoreVersion = useCallback(async (content: string, version: number) => {
    if (!showingHistoryFor) return;

    try {
      // First, save the current version to artifact_versions before overwriting
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

      if (error) {
        toast.error("Failed to restore version", { description: error.message });
        return;
      }

      // Update local state
      if (data && onArtifactUpdated) {
        onArtifactUpdated(data as Artifact);
        toast.success("Version restored successfully");
      }
    } catch (err) {
      toast.error("Failed to restore version", {
        description: err instanceof Error ? err.message : "Unknown error occurred",
      });
    }
  }, [showingHistoryFor, onArtifactUpdated]);
  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, streamingMessage]);

  // Auto-switch to current stage when it changes (highest priority)
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

  // Track artifact changes and show banner only for meaningful updates
  // IMPORTANT: Do NOT call setSelectedPhase here - it causes unwanted resets
  useEffect(() => {
    const currentMap = new Map<ArtifactType, { version: number; contentLength: number; status: string }>();
    
    artifacts.forEach((artifact) => {
      // Skip preview artifacts for banner detection
      if (artifact.id.startsWith("preview-")) return;
      
      currentMap.set(artifact.artifact_type, {
        version: artifact.version,
        contentLength: artifact.content.length,
        status: artifact.status,
      });
      
      const previous = previousArtifactsRef.current.get(artifact.artifact_type);
      
      // Only show banner for new artifacts with substantial content
      if (!previous && artifact.content.length > 100) {
        setBanner({
          type: artifact.artifact_type,
          isNew: true,
          timestamp: Date.now(),
        });
      } 
      // Only show update banner if version increased AND content changed significantly
      else if (previous && 
               artifact.version > previous.version && 
               Math.abs(artifact.content.length - previous.contentLength) > 50) {
        setBanner({
          type: artifact.artifact_type,
          isNew: false,
          timestamp: Date.now(),
        });
      }
    });
    
    previousArtifactsRef.current = currentMap;
  }, [artifacts]);

  // Auto-dismiss banner after 4 seconds (brief notification, not persistent)
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  // Memoized artifact lookup function
  const getArtifactByType = useCallback(
    (type: ArtifactType) => {
      return artifacts.find((a) => a.artifact_type === type);
    },
    [artifacts]
  );

  // Memoize selected artifact to avoid recalculating on each render
  const selectedArtifact = useMemo(
    () => getArtifactByType(selectedPhase),
    [getArtifactByType, selectedPhase]
  );

  const isSelectedSkipped = isQuickMode && isSkippedInQuickMode(selectedPhase);

  // Memoized phase status getter
  const getPhaseStatus = useCallback(
    (type: ArtifactType): "complete" | "active" | "empty" | "skipped" | "pending" => {
      if (isQuickMode && isSkippedInQuickMode(type)) return "skipped";
      const artifact = getArtifactByType(type);
      if (artifact?.status === "approved") return "complete";
      if (artifact && artifact.content.length > 0) return "active";
      // In Quick Mode, show included artifacts as "pending" (they're part of the pipeline)
      if (isQuickMode && !isSkippedInQuickMode(type)) return "pending";
      return "empty";
    },
    [isQuickMode, getArtifactByType]
  );

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

  // Collapsed state: show mini sidebar with expand hint
  if (isCollapsed) {
    return (
      <div className="h-full w-16 bg-card border-l flex flex-col items-center py-3 transition-all duration-300">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCollapsedChange(false)}
                className="mb-3 h-9 w-9 hover:bg-primary/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Expand deliverables</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center gap-1.5 px-2">
            {ARTIFACT_ORDER.map((type, index) => {
              const status = getPhaseStatus(type);
              const artifact = getArtifactByType(type);
              const hasContent = artifact && artifact.content.length > 0;
              
              return (
                <TooltipProvider key={type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (status !== "skipped") {
                            setSelectedPhase(type);
                            handleCollapsedChange(false);
                          }
                        }}
                        disabled={status === "skipped"}
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200",
                          status === "complete" && "bg-sky-500 text-white shadow-sm hover:bg-sky-600",
                          status === "active" && "bg-blue-500/20 text-blue-600 border-2 border-blue-500 hover:bg-blue-500/30",
                          status === "pending" && "bg-amber-500/20 text-amber-600 border border-amber-500/50 hover:bg-amber-500/30",
                          status === "empty" && "bg-muted text-muted-foreground hover:bg-muted/80",
                          status === "skipped" && "bg-muted/30 text-muted-foreground/40 cursor-not-allowed opacity-50",
                          selectedPhase === type && status !== "complete" && status !== "skipped" && "ring-2 ring-primary ring-offset-2"
                        )}
                      >
                        {index + 1}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px]">
                      <p className="font-medium">{ARTIFACT_LABELS[type]}</p>
                      {status === "skipped" && (
                        <p className="text-xs text-muted-foreground">Skipped in Quick Mode</p>
                      )}
                      {status === "complete" && (
                        <p className="text-xs text-emerald-600">✓ Approved</p>
                      )}
                      {status === "active" && (
                        <p className="text-xs text-blue-600">Ready for review</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* Expand hint at bottom */}
        <div className="mt-2 pt-2 border-t border-border/50 w-full flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCollapsedChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </div>
    );
  }

  // Show version history panel if active
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
    <div className="h-full w-full bg-card border-l flex flex-col">
      {/* Brief notification banner - auto-dismisses in 4s */}
      {banner && (
        <div className={cn(
          "px-4 py-2 flex items-center gap-2 border-b animate-in slide-in-from-top-2 duration-200",
          "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/60"
        )}>
          <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 flex-1 truncate">
            <span className="font-medium">{ARTIFACT_LABELS[banner.type]}</span>
            {banner.isNew ? " is ready" : " updated"}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
            onClick={handleDismissBanner}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Canvas Header with Phase Tabs */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Deliverables</h2>
            {isQuickMode && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                Quick Mode
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleExport}
                    disabled={!hasApprovedArtifacts || isExporting}
                    className="h-8 w-8"
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasApprovedArtifacts 
                    ? `Export ${approvedCount} approved deliverable${approvedCount > 1 ? 's' : ''} as PDF`
                    : "Approve deliverables to export"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCollapsedChange(true)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Enhanced Phase Navigation Pills */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs text-muted-foreground font-medium">
              Phase {ARTIFACT_ORDER.indexOf(selectedPhase) + 1} of {isQuickMode ? QUICK_MODE_ARTIFACTS.length : ARTIFACT_ORDER.length}
            </span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all duration-300"
                style={{
                  width: `${(approvedCount / relevantArtifacts.length) * 100}%`
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {approvedCount}/{relevantArtifacts.length}
            </span>
          </div>
          <Tabs value={selectedPhase} onValueChange={(v) => setSelectedPhase(v as ArtifactType)}>
            <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-transparent p-0">
              {ARTIFACT_ORDER.map((type, index) => {
                const status = getPhaseStatus(type);
                const isSkipped = status === "skipped";
                const artifact = getArtifactByType(type);
                const hasContent = artifact && artifact.content.length > 0;
                
                return (
                  <TooltipProvider key={type}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={type}
                          disabled={isSkipped}
                          className={cn(
                            "text-[11px] px-2 py-1 data-[state=active]:shadow-sm rounded-md transition-colors",
                            "flex items-center gap-1 font-medium",
                            status === "complete" && [
                              "bg-sky-500/15 text-sky-700 border border-sky-500/30",
                              "data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:border-sky-600"
                            ],
                            status === "active" && [
                              "bg-blue-500/10 text-blue-700 border border-blue-500/25",
                              "data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-600"
                            ],
                            status === "pending" && [
                              "bg-amber-500/10 text-amber-700 border border-amber-500/25",
                              "data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-600"
                            ],
                            status === "empty" && [
                              "bg-muted/50 text-muted-foreground border border-transparent",
                              "hover:bg-muted",
                              "data-[state=active]:bg-muted data-[state=active]:text-foreground"
                            ],
                            isSkipped && "bg-muted/20 text-muted-foreground/30 line-through cursor-not-allowed opacity-40"
                          )}
                        >
                          {status === "complete" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="text-[10px] font-bold opacity-60">{index + 1}</span>
                          )}
                          {ARTIFACT_SHORT_LABELS[type]}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px]">
                        <p className="font-medium text-xs">{ARTIFACT_LABELS[type]}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {status === "complete" && "✓ Approved"}
                          {status === "active" && "In progress"}
                          {status === "pending" && "Waiting"}
                          {status === "empty" && "Not started"}
                          {status === "skipped" && "Skipped"}
                        </p>
                        {hasContent && artifact && (
                          <p className="text-[10px] text-muted-foreground">v{artifact.version}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Canvas Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4">
          {isSelectedSkipped ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <SkipForward className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-medium mb-2 text-muted-foreground">{ARTIFACT_LABELS[selectedPhase]}</h3>
              <p className="text-sm text-muted-foreground/70 max-w-[250px]">
                This deliverable is skipped in Quick Mode. Switch to Standard Mode for the full pipeline.
              </p>
            </div>
          ) : selectedArtifact && selectedArtifact.content ? (
            <div className="space-y-4">
              {/* Note: Status is shown via badge in ArtifactCardNew - no need for separate StatusBanner
                  Behavioral design: Single clear status indicator reduces cognitive load */}

              {/* Conditionally show editor or ArtifactCardNew */}
              {editingArtifactId === selectedArtifact.id ? (
                <ArtifactEditor
                  artifact={selectedArtifact}
                  onSave={handleArtifactSave}
                  onCancel={handleCancelEdit}
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
                    onCopy={async () => {
                      try {
                        await navigator.clipboard.writeText(selectedArtifact.content);
                        toast.success("Content copied to clipboard");
                      } catch {
                        // Fallback for HTTP or permission denied
                        toast.error("Failed to copy to clipboard");
                      }
                    }}
                    onShare={() => {
                      toast.info("Share functionality coming soon");
                    }}
                  />
                  <AIDisclaimer />
                  
                  {/* Additional actions for non-preview artifacts */}
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
          ) : isStreaming && streamingMessage ? (
            <ArtifactStreamingPreview
              selectedPhase={selectedPhase}
              streamingMessage={streamingMessage}
            />
          ) : (
            (() => {
              // Determine which phase is next in the pipeline that needs to be generated
              const artifactIndex = ARTIFACT_ORDER.indexOf(selectedPhase);
              const previousPhase = artifactIndex > 0 ? ARTIFACT_ORDER[artifactIndex - 1] : null;
              const previousArtifact = previousPhase ? getArtifactByType(previousPhase) : null;
              const isPreviousApproved = previousArtifact?.status === "approved";
              const canGenerate = artifactIndex === 0 || isPreviousApproved;
              const isGenerating = isStreaming || isRegenerating;
              
              // Find the first missing artifact that can be generated
              const firstMissingIndex = ARTIFACT_ORDER.findIndex((type, idx) => {
                if (isQuickMode && isSkippedInQuickMode(type)) return false;
                const artifact = getArtifactByType(type);
                if (!artifact || artifact.content.length === 0) {
                  // Check if previous is approved (or it's the first)
                  if (idx === 0) return true;
                  const prev = getArtifactByType(ARTIFACT_ORDER[idx - 1]);
                  return prev?.status === "approved";
                }
                return false;
              });
              
              const isNextInPipeline = firstMissingIndex === artifactIndex;
              
              return (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                    canGenerate ? "bg-primary/10" : "bg-muted"
                  )}>
                    {isGenerating && isNextInPipeline ? (
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    ) : (
                      <FileText className={cn(
                        "h-8 w-8",
                        canGenerate ? "text-primary" : "text-muted-foreground"
                      )} />
                    )}
                  </div>
                  <h3 className="font-medium mb-2">{ARTIFACT_LABELS[selectedPhase]}</h3>
                  
                  {canGenerate ? (
                    <>
                      <p className="text-sm text-muted-foreground max-w-[250px] mb-4">
                        {isNextInPipeline 
                          ? "Ready to generate! Click below to create this deliverable."
                          : "This deliverable will appear here as we work through the conversation together."}
                      </p>
                      {onGenerate && !isGenerating && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onGenerate(selectedPhase)}
                          className="gap-2"
                        >
                          <Sparkles className="h-4 w-4" />
                          Generate {ARTIFACT_SHORT_LABELS[selectedPhase]}
                        </Button>
                      )}
                      {isGenerating && isNextInPipeline && (
                        <Badge className="status-draft gap-1 animate-pulse">
                          <Sparkles className="h-3 w-3" />
                          Generating...
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground max-w-[250px] mb-2">
                        Complete the previous phase first.
                      </p>
                      {previousPhase && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPhase(previousPhase)}
                          className="gap-2 text-muted-foreground"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Go to {ARTIFACT_SHORT_LABELS[previousPhase]}
                        </Button>
                      )}
                    </>
                  )}
                  
                  {/* Show retry button if current stage matches selected phase but artifact is missing */}
                  {currentStage && STAGE_TO_ARTIFACT[currentStage.toLowerCase().replace(/\s+/g, "_")] === selectedPhase && onRetry && !isStreaming && canGenerate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      className="gap-2 mt-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Retry Generation
                    </Button>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </ScrollArea>

      {/* Pipeline Complete State */}
      {(() => {
        // Use memoized relevantArtifacts from outer scope (no shadowing)
        const allApproved = relevantArtifacts.every(type => {
          const artifact = getArtifactByType(type);
          return artifact?.status === "approved";
        });
        
        if (allApproved) {
          return (
            <>
              {/* Inline indicator */}
              <div className="p-4 border-t bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <PartyPopper className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-600 text-sm">Pipeline Complete!</p>
                    <p className="text-xs text-muted-foreground">All deliverables approved</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleShowCelebration}>
                    View Summary
                  </Button>
                </div>
              </div>

              {/* Celebration Modal */}
              <Dialog open={showCelebration} onOpenChange={(open) => !open && handleHideCelebration()}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="text-center">
                    <div className="text-5xl mb-2">🎉</div>
                    <DialogTitle className="text-xl">You did it!</DialogTitle>
                    <DialogDescription>
                      Your complete training design package is ready.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex justify-center gap-8 py-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{relevantArtifacts.length}</p>
                      <p className="text-sm text-muted-foreground">Deliverables</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-500">100%</p>
                      <p className="text-sm text-muted-foreground">Complete</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={async () => {
                        await handleExport();
                        handleHideCelebration();
                      }}
                      disabled={isExporting}
                      className="w-full gap-2"
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Export Full PDF Package
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleHideCelebration}
                      className="w-full"
                    >
                      Continue Editing
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          );
        }
        return null;
      })()}

      {/* Approve Button */}
      {selectedArtifact?.content && selectedArtifact.status === "draft" && onApprove && !selectedArtifact.id.startsWith("preview-") && !isSelectedSkipped && (
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
            {isApproving ? "Approving..." : `Approve ${ARTIFACT_SHORT_LABELS[selectedPhase]}`}
          </Button>
        </div>
      )}
    </div>
  );
}
