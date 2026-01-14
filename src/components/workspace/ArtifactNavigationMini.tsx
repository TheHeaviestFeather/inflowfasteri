/**
 * Collapsed artifact navigation sidebar
 * Shows numbered phase indicators with status colors
 */

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS } from "@/types/database";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PhaseStatus = "complete" | "active" | "empty" | "skipped" | "pending";

interface ArtifactNavigationMiniProps {
  selectedPhase: ArtifactType;
  onSelectPhase: (phase: ArtifactType) => void;
  onExpand: () => void;
  getPhaseStatus: (type: ArtifactType) => PhaseStatus;
  hasContent: (type: ArtifactType) => boolean;
}

export function ArtifactNavigationMini({
  selectedPhase,
  onSelectPhase,
  onExpand,
  getPhaseStatus,
  hasContent,
}: ArtifactNavigationMiniProps) {
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
            const hasArtifactContent = hasContent(type);

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
