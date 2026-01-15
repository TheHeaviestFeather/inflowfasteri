import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS } from "@/types/database";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhaseStatus } from "./types";

interface CollapsedArtifactSidebarProps {
  selectedPhase: ArtifactType;
  onSelectPhase: (phase: ArtifactType) => void;
  onExpand: () => void;
  getPhaseStatus: (type: ArtifactType) => PhaseStatus;
  getArtifactByType: (type: ArtifactType) => Artifact | undefined;
}

export function CollapsedArtifactSidebar({
  selectedPhase,
  onSelectPhase,
  onExpand,
  getPhaseStatus,
  getArtifactByType,
}: CollapsedArtifactSidebarProps) {
  return (
    <div className="h-full w-16 bg-card border-l flex flex-col items-center py-3 transition-all duration-300">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpand}
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
                          onSelectPhase(type);
                          onExpand();
                        }
                      }}
                      disabled={status === "skipped"}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200",
                        status === "complete" && "bg-success text-success-foreground shadow-sm hover:bg-success/90",
                        status === "active" && "bg-primary/20 text-primary border-2 border-primary hover:bg-primary/30",
                        status === "pending" && "bg-warning/20 text-warning border border-warning/50 hover:bg-warning/30",
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
                      <p className="text-xs text-success">✓ Approved</p>
                    )}
                    {status === "active" && (
                      <p className="text-xs text-primary">Ready for review</p>
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
          onClick={onExpand}
          className="text-xs text-muted-foreground hover:text-foreground px-2"
        >
          <ChevronLeft className="h-3 w-3 mr-1" />
          View
        </Button>
      </div>
    </div>
  );
}
