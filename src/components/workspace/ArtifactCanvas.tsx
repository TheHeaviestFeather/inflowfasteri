import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, isSkippedInQuickMode } from "@/types/database";
import { Check, Clock, AlertTriangle, FileText, ChevronLeft, ChevronRight, SkipForward, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  onApprove?: (artifactId: string) => void;
  isStreaming?: boolean;
  mode?: "standard" | "quick";
  currentStage?: string | null;
}

// Map pipeline stage names to artifact types
const STAGE_TO_ARTIFACT: Record<string, ArtifactType> = {
  "phase_1_contract": "phase_1_contract",
  "contract": "phase_1_contract",
  "discovery": "discovery_report",
  "discovery_report": "discovery_report",
  "learner_persona": "learner_persona",
  "persona": "learner_persona",
  "design_strategy": "design_strategy",
  "strategy": "design_strategy",
  "design_blueprint": "design_blueprint",
  "blueprint": "design_blueprint",
  "scenario_bank": "scenario_bank",
  "scenarios": "scenario_bank",
  "assessment_kit": "assessment_kit",
  "assessment": "assessment_kit",
  "final_audit": "final_audit",
  "audit": "final_audit",
  "performance_recommendation_report": "performance_recommendation_report",
  "report": "performance_recommendation_report",
  "pirr": "performance_recommendation_report",
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

// Clean artifact content for display - remove JSON artifacts, fix formatting
function cleanArtifactContent(content: string): string {
  let cleaned = content;
  
  // Remove trailing status:draft]] or similar artifacts from database queries
  cleaned = cleaned.replace(/\s*status:\w+\]*\]*$/gi, "");
  
  // Remove any JSON blocks that might have leaked through
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, "");
  cleaned = cleaned.replace(/STATE:\s*\{[\s\S]*?\}/gi, "");
  
  // Convert **Label:** Value format to proper list items where appropriate
  // Only for lines that start with spaces (indented content)
  cleaned = cleaned.replace(/^(\s+)\*\*([^*:]+):\*\*\s*(.+)$/gm, "$1- **$2:** $3");
  
  // Convert standalone **Label:** on its own line to a heading-like bold
  cleaned = cleaned.replace(/^\s*\*\*([^*:]+):\*\*\s*$/gm, "\n**$1:**");
  
  // Clean up excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  
  // Ensure quotes are properly formatted as blockquotes
  cleaned = cleaned.replace(/^\s*-\s*"([^"]+)"/gm, '\n> "$1"');
  
  return cleaned.trim();
}

export function ArtifactCanvas({ artifacts, onApprove, isStreaming, mode = "standard", currentStage }: ArtifactCanvasProps) {
  const [selectedPhase, setSelectedPhase] = useState<ArtifactType>("phase_1_contract");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [banner, setBanner] = useState<DeliverableBanner | null>(null);
  const previousArtifactsRef = useRef<Map<ArtifactType, { version: number; contentLength: number }>>(new Map());
  const previousStageRef = useRef<string | null>(null);

  const isQuickMode = mode === "quick";

  // Auto-switch to current stage when it changes
  useEffect(() => {
    if (currentStage && currentStage !== previousStageRef.current) {
      const normalizedStage = currentStage.toLowerCase().replace(/\s+/g, "_");
      const artifactType = STAGE_TO_ARTIFACT[normalizedStage];
      
      if (artifactType) {
        // Only switch if it's not a skipped phase in quick mode
        if (!isQuickMode || !isSkippedInQuickMode(artifactType)) {
          setSelectedPhase(artifactType);
        }
      }
      previousStageRef.current = currentStage;
    }
  }, [currentStage, isQuickMode]);

  // Track artifact changes and show banner only for meaningful updates
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
      
      // Only show banner for new artifacts with substantial content (>100 chars)
      if (!previous && artifact.content.length > 100) {
        setBanner({
          type: artifact.artifact_type,
          isNew: true,
          timestamp: Date.now(),
        });
        setSelectedPhase(artifact.artifact_type);
      } 
      // Only show update banner if version increased AND content actually changed significantly
      else if (previous && 
               artifact.version > previous.version && 
               Math.abs(artifact.content.length - previous.contentLength) > 50) {
        setBanner({
          type: artifact.artifact_type,
          isNew: false,
          timestamp: Date.now(),
        });
        setSelectedPhase(artifact.artifact_type);
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
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "stale":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Needs Review
          </Badge>
        );
      case "draft":
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
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
                  status === "complete" && "bg-primary text-primary-foreground",
                  status === "active" && "bg-primary/20 text-primary border border-primary",
                  status === "pending" && "bg-amber-500/20 text-amber-600 border border-amber-500/50",
                  status === "empty" && "bg-muted text-muted-foreground hover:bg-muted/80",
                  status === "skipped" && "bg-muted/30 text-muted-foreground/40 cursor-not-allowed line-through",
                  selectedPhase === type && status !== "complete" && status !== "skipped" && "ring-2 ring-primary ring-offset-2"
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-2 pb-2">
          <Tabs value={selectedPhase} onValueChange={(v) => setSelectedPhase(v as ArtifactType)}>
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-transparent p-0">
              {ARTIFACT_ORDER.map((type, index) => {
                const status = getPhaseStatus(type);
                const isSkipped = status === "skipped";
                return (
                  <TabsTrigger
                    key={type}
                    value={type}
                    disabled={isSkipped}
                    className={cn(
                      "text-xs px-2 py-1.5 data-[state=active]:shadow-none rounded-md",
                      status === "complete" && "bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                      status === "active" && "bg-blue-500/10 text-blue-600 data-[state=active]:bg-blue-500 data-[state=active]:text-white",
                      status === "pending" && "bg-amber-500/10 text-amber-600 border border-amber-500/30 data-[state=active]:bg-amber-500 data-[state=active]:text-white",
                      status === "empty" && "bg-muted text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground",
                      isSkipped && "bg-muted/20 text-muted-foreground/30 line-through cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="mr-1 font-bold">{index + 1}</span>
                    {SHORT_LABELS[type]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Canvas Content */}
      <ScrollArea className="flex-1">
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
                  {cleanArtifactContent(selectedArtifact.content)}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">{ARTIFACT_LABELS[selectedPhase]}</h3>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                This deliverable will appear here as we work through the conversation together.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

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
