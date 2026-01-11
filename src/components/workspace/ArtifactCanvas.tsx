import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, isSkippedInQuickMode, QUICK_MODE_ARTIFACTS } from "@/types/database";
import { Check, Clock, AlertTriangle, FileText, ChevronLeft, ChevronRight, SkipForward, Sparkles, X, RotateCcw, Download, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { formatArtifactContent } from "@/utils/artifactFormatter";
import { useExportPDF } from "@/hooks/useExportPDF";
import { toast } from "sonner";
import { ArtifactActions, AIDisclaimer } from "./ArtifactActions";
import { ArtifactEditor } from "./ArtifactEditor";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { supabase } from "@/integrations/supabase/client";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  onApprove?: (artifactId: string) => void;
  onRetry?: () => void;
  onRegenerate?: (artifactType: string) => void;
  onArtifactUpdated?: (artifact: Artifact) => void;
  isStreaming?: boolean;
  isRegenerating?: boolean;
  streamingMessage?: string | null;
  mode?: "standard" | "quick";
  currentStage?: string | null;
  projectName?: string;
}

// Extract readable content from streaming message for fallback display
function extractStreamingPreview(content: string): string {
  let preview = content;
  
  // Extract content after **DELIVERABLE:** if present
  const deliverableMatch = preview.match(/\*\*DELIVERABLE:\s*[^*]+\*\*\s*([\s\S]*)/i);
  if (deliverableMatch) {
    preview = deliverableMatch[1];
  }
  
  // Remove everything from STATE or ```json onward
  const cutPoints = [
    preview.search(/\nSTATE\b/i),
    preview.search(/\n```json\b/i),
    preview.search(/\n✅\s*Saved/i),
    preview.search(/\nCommands:/i),
  ].filter((i) => i >= 0);

  if (cutPoints.length > 0) {
    preview = preview.slice(0, Math.min(...cutPoints));
  }

  // Clean up
  return preview.trim();
}

// Map pipeline stage names to artifact types
// Supports various naming conventions the AI might use
const STAGE_TO_ARTIFACT: Record<string, ArtifactType> = {
  // Phase 1 Contract
  "phase_1_contract": "phase_1_contract",
  "contract": "phase_1_contract",
  "phase_1": "phase_1_contract",
  "contracting": "phase_1_contract",
  
  // Discovery Report
  "discovery": "discovery_report",
  "discovery_report": "discovery_report",
  "needs_analysis": "discovery_report",
  "analysis": "discovery_report",
  
  // Learner Persona
  "learner_persona": "learner_persona",
  "persona": "learner_persona",
  "learner_analysis": "learner_persona",
  
  // Design Strategy
  "design_strategy": "design_strategy",
  "strategy": "design_strategy",
  "instructional_strategy": "design_strategy",
  
  // Design Blueprint
  "design_blueprint": "design_blueprint",
  "blueprint": "design_blueprint",
  "content_development": "design_blueprint",
  "module_design": "design_blueprint",
  "course_outline": "design_blueprint",
  
  // Scenario Bank
  "scenario_bank": "scenario_bank",
  "scenarios": "scenario_bank",
  "scenario_development": "scenario_bank",
  "practice_scenarios": "scenario_bank",
  
  // Assessment Kit
  "assessment_kit": "assessment_kit",
  "assessment": "assessment_kit",
  "assessment_development": "assessment_kit",
  "evaluation": "assessment_kit",
  
  // Final Audit
  "final_audit": "final_audit",
  "audit": "final_audit",
  "quality_review": "final_audit",
  "final_review": "final_audit",
  
  // Performance Recommendation Report
  "performance_recommendation_report": "performance_recommendation_report",
  "report": "performance_recommendation_report",
  "pirr": "performance_recommendation_report",
  "recommendations": "performance_recommendation_report",
  "performance_report": "performance_recommendation_report",
};

interface DeliverableBanner {
  type: ArtifactType;
  isNew: boolean;
  timestamp: number;
}

const SHORT_LABELS: Record<ArtifactType, string> = {
  phase_1_contract: "Contract",
  discovery_report: "Discovery",
  learner_persona: "Persona",
  design_strategy: "Strategy",
  design_blueprint: "Blueprint",
  scenario_bank: "Scenarios",
  assessment_kit: "Assessment",
  final_audit: "Audit",
  performance_recommendation_report: "Report",
};

// Formatter is now imported from @/utils/artifactFormatter

export function ArtifactCanvas({ artifacts, onApprove, onRetry, onRegenerate, onArtifactUpdated, isStreaming, isRegenerating, streamingMessage, mode = "standard", currentStage, projectName = "Project" }: ArtifactCanvasProps) {
  const [selectedPhase, setSelectedPhase] = useState<ArtifactType>("phase_1_contract");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [banner, setBanner] = useState<DeliverableBanner | null>(null);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const [showingHistoryFor, setShowingHistoryFor] = useState<Artifact | null>(null);
  const previousArtifactsRef = useRef<Map<ArtifactType, { version: number; contentLength: number }>>(new Map());
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

  // Handle version restore
  const handleRestoreVersion = useCallback(async (content: string, version: number) => {
    if (!showingHistoryFor) return;
    
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

    if (error) throw error;

    // Update local state
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

  // Auto-dismiss banner after 8 seconds
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  const getArtifactByType = (type: ArtifactType) => {
    return artifacts.find((a) => a.artifact_type === type);
  };

  const selectedArtifact = getArtifactByType(selectedPhase);
  const isSelectedSkipped = isQuickMode && isSkippedInQuickMode(selectedPhase);

  const getPhaseStatus = (type: ArtifactType): "complete" | "active" | "empty" | "skipped" | "pending" => {
    if (isQuickMode && isSkippedInQuickMode(type)) return "skipped";
    const artifact = getArtifactByType(type);
    if (artifact?.status === "approved") return "complete";
    if (artifact && artifact.content.length > 0) return "active";
    // In Quick Mode, show included artifacts as "pending" (they're part of the pipeline)
    if (isQuickMode && !isSkippedInQuickMode(type)) return "pending";
    return "empty";
  };

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

  if (isCollapsed) {
    return (
      <div className="h-full w-12 bg-muted/30 border-l flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex flex-col items-center gap-2">
          {ARTIFACT_ORDER.map((type, index) => {
            const status = getPhaseStatus(type);
            return (
              <button
                key={type}
                onClick={() => {
                  if (status !== "skipped") {
                    setSelectedPhase(type);
                    setIsCollapsed(false);
                  }
                }}
                disabled={status === "skipped"}
                className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium transition-colors",
                  status === "complete" && "bg-sky-500 text-white",
                  status === "active" && "bg-blue-500/20 text-blue-600 border border-blue-500",
                  status === "pending" && "bg-amber-500/20 text-amber-600 border border-amber-500/50",
                  status === "empty" && "bg-muted text-muted-foreground hover:bg-muted/80",
                  status === "skipped" && "bg-muted/30 text-muted-foreground/40 cursor-not-allowed line-through",
                  selectedPhase === type && status !== "complete" && status !== "skipped" && "ring-2 ring-blue-500 ring-offset-2"
                )}
                title={status === "skipped" ? `${ARTIFACT_LABELS[type]} (Skipped in Quick Mode)` : ARTIFACT_LABELS[type]}
              >
                {index + 1}
              </button>
            );
          })}
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
    <div className="h-full w-[450px] bg-card border-l flex flex-col">
      {/* New Deliverable Banner */}
      {banner && (
        <div className={cn(
          "px-4 py-3 flex items-center gap-3 border-b animate-in slide-in-from-top duration-300",
          banner.isNew 
            ? "bg-gradient-to-r from-orange-500/25 via-amber-500/15 to-orange-400/10 border-orange-500/40"
            : "bg-gradient-to-r from-amber-500/25 via-orange-500/15 to-amber-400/10 border-amber-500/40"
        )}>
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center animate-pulse",
            banner.isNew ? "bg-orange-500/25" : "bg-amber-500/25"
          )}>
            <Sparkles className={cn(
              "h-5 w-5",
              banner.isNew ? "text-orange-500" : "text-amber-500"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-semibold text-sm",
              banner.isNew ? "text-orange-600" : "text-amber-600"
            )}>
              {banner.isNew ? "New Deliverable Ready!" : "Deliverable Updated!"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {ARTIFACT_LABELS[banner.type]} is now available below
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => setBanner(null)}
          >
            <X className="h-4 w-4" />
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
              onClick={() => setIsCollapsed(true)}
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
                  width: `${((relevantArtifacts.filter(type => {
                    const artifact = artifacts.find(a => a.artifact_type === type);
                    return artifact?.status === "approved";
                  }).length) / relevantArtifacts.length) * 100}%` 
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {relevantArtifacts.filter(type => {
                const artifact = artifacts.find(a => a.artifact_type === type);
                return artifact?.status === "approved";
              }).length}/{relevantArtifacts.length}
            </span>
          </div>
          <Tabs value={selectedPhase} onValueChange={(v) => setSelectedPhase(v as ArtifactType)}>
            <TabsList className="w-full h-auto flex flex-wrap gap-1.5 bg-transparent p-0">
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
                            "relative text-xs px-3 py-2 data-[state=active]:shadow-md rounded-lg transition-all duration-200",
                            "hover:scale-[1.02] active:scale-[0.98]",
                            "flex items-center gap-1.5 font-medium",
                            status === "complete" && [
                              "bg-gradient-to-br from-sky-500/20 to-sky-600/10 text-sky-700 border border-sky-500/40",
                              "data-[state=active]:from-sky-500 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:border-sky-600",
                              "data-[state=active]:shadow-sky-500/25"
                            ],
                            status === "active" && [
                              "bg-gradient-to-br from-blue-500/15 to-blue-600/10 text-blue-700 border border-blue-500/30",
                              "data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600",
                              "data-[state=active]:shadow-blue-500/25",
                              "animate-pulse"
                            ],
                            status === "pending" && [
                              "bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-700 border border-amber-500/30",
                              "data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:border-amber-600",
                              "data-[state=active]:shadow-amber-500/25"
                            ],
                            status === "empty" && [
                              "bg-muted/50 text-muted-foreground border border-transparent",
                              "hover:bg-muted hover:border-border",
                              "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border-border"
                            ],
                            isSkipped && "bg-muted/20 text-muted-foreground/30 line-through cursor-not-allowed opacity-40"
                          )}
                        >
                          {status === "complete" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                              status === "active" && "bg-blue-500/20",
                              status === "pending" && "bg-amber-500/20",
                              status === "empty" && "bg-muted-foreground/10"
                            )}>
                              {index + 1}
                            </span>
                          )}
                          {SHORT_LABELS[type]}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px]">
                        <p className="font-medium">{ARTIFACT_LABELS[type]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {status === "complete" && "✓ Approved"}
                          {status === "active" && "In progress"}
                          {status === "pending" && "Waiting for previous phases"}
                          {status === "empty" && "Not started"}
                          {status === "skipped" && "Skipped in Quick Mode"}
                        </p>
                        {hasContent && artifact && (
                          <p className="text-xs text-muted-foreground mt-1">v{artifact.version}</p>
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
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{ARTIFACT_LABELS[selectedPhase]}</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedArtifact)}
                  <span className="text-xs text-muted-foreground">v{selectedArtifact.version}</span>
                </div>
              </div>
              
              {/* Artifact Actions Bar */}
              {!selectedArtifact.id.startsWith("preview-") && !isStreaming && (
                <ArtifactActions
                  artifact={selectedArtifact}
                  onEdit={() => setEditingArtifactId(selectedArtifact.id)}
                  onExport={(format) => {
                    if (format === "md") {
                      handleExportMarkdown(selectedArtifact);
                    }
                  }}
                  onRegenerate={onRegenerate ? () => onRegenerate(selectedArtifact.artifact_type) : undefined}
                  isRegenerating={isRegenerating}
                  onShowHistory={() => setShowingHistoryFor(selectedArtifact)}
                />
              )}

              {/* Conditionally show editor or content */}
              {editingArtifactId === selectedArtifact.id ? (
                <ArtifactEditor
                  artifact={selectedArtifact}
                  onSave={handleArtifactSave}
                  onCancel={() => setEditingArtifactId(null)}
                />
              ) : (
                <>
                  <div className={cn(
                    "text-sm leading-relaxed bg-muted/30 rounded-lg p-5 border",
                    "prose prose-sm max-w-none dark:prose-invert",
                    "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3",
                    "prose-h3:text-base prose-h3:border-b prose-h3:pb-2 prose-h3:border-border",
                    "prose-h4:text-sm prose-h4:mt-4",
                    "prose-p:my-2 prose-p:leading-relaxed prose-p:text-foreground/90",
                    "prose-ul:my-3 prose-ul:pl-5 prose-ul:list-disc",
                    "prose-ol:my-3 prose-ol:pl-5 prose-ol:list-decimal",
                    "prose-li:my-1 prose-li:leading-relaxed prose-li:text-foreground/90",
                    "[&_ul_ul]:mt-1 [&_ul_ul]:mb-1 [&_li>ul]:pl-4",
                    "prose-strong:text-foreground prose-strong:font-semibold",
                    "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:italic",
                    "[&>*:first-child]:mt-0",
                    isStreaming && selectedArtifact.id.startsWith("preview-") && "animate-pulse"
                  )}>
                    <ReactMarkdown>
                      {formatArtifactContent(selectedArtifact.content, selectedArtifact.artifact_type)}
                    </ReactMarkdown>
                  </div>
                  <AIDisclaimer />
                </>
              )}
            </div>
          ) : isStreaming && streamingMessage ? (
            // Fallback: show raw streaming content when no artifact parsed yet
            (() => {
              const streamingPreview = extractStreamingPreview(streamingMessage);
              if (streamingPreview.length > 20) {
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{ARTIFACT_LABELS[selectedPhase]}</h3>
                      <Badge className="status-draft gap-1 animate-pulse">
                        <Sparkles className="h-3 w-3" />
                        Generating...
                      </Badge>
                    </div>
                    <div className={cn(
                      "text-sm leading-relaxed bg-muted/30 rounded-lg p-5 border animate-pulse",
                      "prose prose-sm max-w-none dark:prose-invert",
                      "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3",
                      "prose-p:my-2 prose-p:leading-relaxed prose-p:text-foreground/90",
                      "prose-ul:my-3 prose-ul:pl-5 prose-ul:list-disc",
                      "prose-li:my-1 prose-li:leading-relaxed prose-li:text-foreground/90",
                      "prose-strong:text-foreground prose-strong:font-semibold",
                      "[&>*:first-child]:mt-0"
                    )}>
                      <ReactMarkdown>{streamingPreview}</ReactMarkdown>
                    </div>
                  </div>
                );
              }
              // Not enough content yet, show loading state
              return (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-medium mb-2">{ARTIFACT_LABELS[selectedPhase]}</h3>
                  <p className="text-sm text-muted-foreground max-w-[250px]">
                    Generating deliverable...
                  </p>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">{ARTIFACT_LABELS[selectedPhase]}</h3>
              <p className="text-sm text-muted-foreground max-w-[250px] mb-4">
                This deliverable will appear here as we work through the conversation together.
              </p>
              {/* Show retry button if current stage matches selected phase but artifact is missing */}
              {currentStage && STAGE_TO_ARTIFACT[currentStage.toLowerCase().replace(/\s+/g, "_")] === selectedPhase && onRetry && !isStreaming && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry Generation
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pipeline Complete State */}
      {(() => {
        const relevantArtifacts = isQuickMode ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;
        const allApproved = relevantArtifacts.every(type => {
          const artifact = getArtifactByType(type);
          return artifact?.status === "approved";
        });
        
        if (allApproved) {
          return (
            <div className="p-4 border-t bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-600 text-sm">Pipeline Complete!</p>
                  <p className="text-xs text-muted-foreground">All deliverables have been approved</p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Approve Button */}
      {selectedArtifact?.content && selectedArtifact.status === "draft" && onApprove && !selectedArtifact.id.startsWith("preview-") && !isSelectedSkipped && (
        <div className="p-4 border-t">
          <Button
            onClick={() => onApprove(selectedArtifact.id)}
            className="w-full gap-2"
            disabled={isStreaming}
          >
            <Check className="h-4 w-4" />
            Approve {SHORT_LABELS[selectedPhase]}
          </Button>
        </div>
      )}
    </div>
  );
}
