import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, isSkippedInQuickMode } from "@/types/database";
import { Check, Clock, AlertTriangle, FileText, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  onApprove?: (artifactId: string) => void;
  isStreaming?: boolean;
  mode?: "standard" | "quick";
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

export function ArtifactCanvas({ artifacts, onApprove, isStreaming, mode = "standard" }: ArtifactCanvasProps) {
  const [selectedPhase, setSelectedPhase] = useState<ArtifactType>("phase_1_contract");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isQuickMode = mode === "quick";

  const getArtifactByType = (type: ArtifactType) => {
    return artifacts.find((a) => a.artifact_type === type);
  };

  const selectedArtifact = getArtifactByType(selectedPhase);
  const isSelectedSkipped = isQuickMode && isSkippedInQuickMode(selectedPhase);

  const getPhaseStatus = (type: ArtifactType): "complete" | "active" | "empty" | "skipped" => {
    if (isQuickMode && isSkippedInQuickMode(type)) return "skipped";
    const artifact = getArtifactByType(type);
    if (artifact?.status === "approved") return "complete";
    if (artifact && artifact.content.length > 0) return "active";
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
                "text-sm leading-relaxed bg-muted/30 rounded-lg p-4 border prose prose-sm max-w-none dark:prose-invert",
                isStreaming && selectedArtifact.id.startsWith("preview-") && "animate-pulse"
              )}>
                <ReactMarkdown>
                  {selectedArtifact.content}
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
