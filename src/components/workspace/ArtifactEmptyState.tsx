/**
 * Empty state component for artifact canvas
 * Shows different states: skipped, generating, waiting, or ready to generate
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtifactType, ARTIFACT_LABELS, ARTIFACT_SHORT_LABELS } from "@/types/database";
import { FileText, SkipForward, Sparkles, ChevronLeft, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtifactEmptyStateProps {
  selectedPhase: ArtifactType;
  isSkipped: boolean;
  canGenerate: boolean;
  isGenerating: boolean;
  isNextInPipeline: boolean;
  previousPhase: ArtifactType | null;
  onGenerate?: (artifactType: string) => void;
  onSelectPhase: (phase: ArtifactType) => void;
  onRetry?: () => void;
  showRetry: boolean;
}

export function ArtifactEmptyState({
  selectedPhase,
  isSkipped,
  canGenerate,
  isGenerating,
  isNextInPipeline,
  previousPhase,
  onGenerate,
  onSelectPhase,
  onRetry,
  showRetry,
}: ArtifactEmptyStateProps) {
  // Skipped state (Quick Mode)
  if (isSkipped) {
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
              onClick={() => onSelectPhase(previousPhase)}
              className="gap-2 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Go to {ARTIFACT_SHORT_LABELS[previousPhase]}
            </Button>
          )}
        </>
      )}

      {/* Retry button */}
      {showRetry && onRetry && canGenerate && (
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
}
