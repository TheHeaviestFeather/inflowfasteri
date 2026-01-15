import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS, QUICK_MODE_ARTIFACTS } from "@/types/database";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhaseStatus, SHORT_LABELS } from "./types";

interface ArtifactPhaseTabsProps {
  selectedPhase: ArtifactType;
  onSelectPhase: (phase: ArtifactType) => void;
  isQuickMode: boolean;
  artifacts: Artifact[];
  getPhaseStatus: (type: ArtifactType) => PhaseStatus;
  getArtifactByType: (type: ArtifactType) => Artifact | undefined;
}

export function ArtifactPhaseTabs({
  selectedPhase,
  onSelectPhase,
  isQuickMode,
  artifacts,
  getPhaseStatus,
  getArtifactByType,
}: ArtifactPhaseTabsProps) {
  const relevantArtifacts = isQuickMode ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;

  const approvedCount = relevantArtifacts.filter(type => {
    const artifact = artifacts.find(a => a.artifact_type === type);
    return artifact?.status === "approved";
  }).length;

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs text-muted-foreground font-medium">
          Phase {ARTIFACT_ORDER.indexOf(selectedPhase) + 1} of {isQuickMode ? QUICK_MODE_ARTIFACTS.length : ARTIFACT_ORDER.length}
        </span>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-complete transition-all duration-300"
            style={{
              width: `${(approvedCount / relevantArtifacts.length) * 100}%`
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {approvedCount}/{relevantArtifacts.length}
        </span>
      </div>
      <Tabs value={selectedPhase} onValueChange={(v) => onSelectPhase(v as ArtifactType)}>
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
                          "bg-complete/15 text-complete border border-complete/30",
                          "data-[state=active]:bg-complete data-[state=active]:text-complete-foreground data-[state=active]:border-complete"
                        ],
                        status === "active" && [
                          "bg-primary/10 text-primary border border-primary/25",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
                        ],
                        status === "pending" && [
                          "bg-warning/10 text-warning border border-warning/25",
                          "data-[state=active]:bg-warning data-[state=active]:text-warning-foreground data-[state=active]:border-warning"
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
                      {SHORT_LABELS[type]}
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
  );
}
