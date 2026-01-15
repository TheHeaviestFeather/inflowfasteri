import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Artifact, ARTIFACT_ORDER, ARTIFACT_LABELS, ArtifactType, QUICK_MODE_ARTIFACTS, isSkippedInQuickMode } from "@/types/database";

interface PhaseProgressProps {
  artifacts: Artifact[];
  currentStage?: string | null;
  mode?: "standard" | "quick";
}

const PHASE_DESCRIPTIONS: Record<ArtifactType, string> = {
  phase_1_contract: "Define project scope and stakeholder agreement",
  discovery_report: "Analyze training needs and current state",
  learner_persona: "Understand your target learners",
  design_strategy: "Choose instructional approach",
  design_blueprint: "Map content and learning flow",
  scenario_bank: "Create practice scenarios",
  assessment_kit: "Design evaluation methods",
  final_audit: "Quality review and sign-off",
  performance_recommendation_report: "Post-training recommendations",
};

export function PhaseProgress({ artifacts, currentStage, mode = "standard" }: PhaseProgressProps) {
  const isQuickMode = mode === "quick";
  const relevantArtifacts = isQuickMode ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;
  
  const getPhaseStatus = (type: ArtifactType): "complete" | "current" | "pending" | "skipped" => {
    // In quick mode, mark skipped artifacts
    if (isQuickMode && isSkippedInQuickMode(type)) return "skipped";
    
    const artifact = artifacts.find(a => a.artifact_type === type);
    if (artifact?.status === "approved") return "complete";
    if (artifact && artifact.content.length > 0) return "current";
    
    // Check if previous phases are complete (only check relevant phases in quick mode)
    const checkOrder = relevantArtifacts;
    const typeIndex = checkOrder.indexOf(type);
    
    if (typeIndex === -1) return "pending"; // Type not in current mode
    
    const previousComplete = checkOrder.slice(0, typeIndex).every(prevType => {
      const prevArtifact = artifacts.find(a => a.artifact_type === prevType);
      return prevArtifact?.status === "approved";
    });
    
    if (previousComplete && typeIndex === 0) return "current";
    if (previousComplete) {
      const prevArtifact = artifacts.find(a => a.artifact_type === checkOrder[typeIndex - 1]);
      if (prevArtifact?.status === "approved") return "current";
    }
    
    return "pending";
  };

  // Only show relevant phases for the current mode
  const displayOrder = relevantArtifacts;
  const completedCount = displayOrder.filter(type => {
    const artifact = artifacts.find(a => a.artifact_type === type);
    return artifact?.status === "approved";
  }).length;
  
  const currentPhaseIndex = displayOrder.findIndex(type => getPhaseStatus(type) === "current");
  const displayPhase = currentPhaseIndex >= 0 ? currentPhaseIndex + 1 : completedCount + 1;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <div className="flex flex-col mr-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Phase {Math.min(displayPhase, displayOrder.length)} of {displayOrder.length}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {completedCount === 0 && "Great start! Most finish Phase 1 in ~10 min"}
            {completedCount > 0 && completedCount < displayOrder.length - 1 && `${completedCount} approved — keep going!`}
            {completedCount === displayOrder.length - 1 && "Almost there! One more to go"}
            {completedCount === displayOrder.length && "🎉 All complete!"}
          </span>
        </div>
        <div className="flex items-center">
          {displayOrder.map((type, index) => {
            const status = getPhaseStatus(type);
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                        status === "complete" && "bg-primary text-primary-foreground",
                        status === "current" && "bg-primary/20 text-primary border-2 border-primary",
                        status === "pending" && "bg-muted text-muted-foreground",
                        status === "skipped" && "bg-muted/50 text-muted-foreground/50"
                      )}
                    >
                      {status === "complete" ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    {index < displayOrder.length - 1 && (
                      <div
                        className={cn(
                          "w-2 h-0.5",
                          status === "complete" ? "bg-primary" : "bg-muted"
                        )}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">{ARTIFACT_LABELS[type]}</p>
                  <p className="text-xs text-muted-foreground">{PHASE_DESCRIPTIONS[type]}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
