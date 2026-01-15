import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, isSkippedInQuickMode } from "@/types/database";
import { FileText, SkipForward, Sparkles, ChevronLeft, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHORT_LABELS, STAGE_TO_ARTIFACT } from "./types";
import { Artifact } from "@/types/database";

interface ArtifactEmptyStateProps {
  selectedPhase: ArtifactType;
  isQuickMode: boolean;
  isStreaming: boolean;
  isRegenerating: boolean;
  currentStage: string | null;
  onSelectPhase: (phase: ArtifactType) => void;
  onGenerate?: (artifactType: string) => void;
  onRetry?: (artifactType: string) => void;
  getArtifactByType: (type: ArtifactType) => Artifact | undefined;
}

export function ArtifactEmptyState({
  selectedPhase,
  isQuickMode,
  isStreaming,
  isRegenerating,
  currentStage,
  onSelectPhase,
  onGenerate,
  onRetry,
  getArtifactByType,
}: ArtifactEmptyStateProps) {
  const isSelectedSkipped = isQuickMode && isSkippedInQuickMode(selectedPhase);

  // Skipped state (Quick Mode)
  if (isSelectedSkipped) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <SkipForward className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-medium mb-2 text-muted-foreground">{ARTIFACT_LABELS[selectedPhase]}</h3>
        <p className="text-sm text-muted-foreground/70 max-w-[250px]">
          This deliverable is skipped in Quick Mode. Switch to Standard Mode for the full pipeline.
        </p>
      </div>
    );
  }

  // Not started state
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
              Generate {SHORT_LABELS[selectedPhase]}
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
              onClick={() => onSelectPhase(previousPhase)}
              className="gap-2 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Go to {SHORT_LABELS[previousPhase]}
            </Button>
          )}
        </>
      )}

      {/* Show retry button if current stage matches selected phase but artifact is missing */}
      {currentStage && STAGE_TO_ARTIFACT[currentStage.toLowerCase().replace(/\s+/g, "_")] === selectedPhase && onRetry && !isStreaming && canGenerate && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRetry(selectedPhase)}
          className="gap-2 mt-2"
        >
          <RotateCcw className="h-4 w-4" />
          Retry Generation
        </Button>
      )}
    </div>
  );
}
