import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Artifact, ARTIFACT_ORDER, ARTIFACT_LABELS, ArtifactType } from "@/types/database";

interface PhaseProgressProps {
  artifacts: Artifact[];
  currentStage?: string | null;
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

export function PhaseProgress({ artifacts, currentStage }: PhaseProgressProps) {
  const getPhaseStatus = (type: ArtifactType): "complete" | "current" | "pending" => {
    const artifact = artifacts.find(a => a.artifact_type === type);
    if (artifact?.status === "approved") return "complete";
    if (artifact && artifact.content.length > 0) return "current";
    
    // Check if previous phases are complete
    const typeIndex = ARTIFACT_ORDER.indexOf(type);
    const previousComplete = ARTIFACT_ORDER.slice(0, typeIndex).every(prevType => {
      const prevArtifact = artifacts.find(a => a.artifact_type === prevType);
      return prevArtifact?.status === "approved";
    });
    
    if (previousComplete && typeIndex === 0) return "current";
    if (previousComplete) {
      const prevArtifact = artifacts.find(a => a.artifact_type === ARTIFACT_ORDER[typeIndex - 1]);
      if (prevArtifact?.status === "approved") return "current";
    }
    
    return "pending";
  };

  const completedCount = artifacts.filter(a => a.status === "approved").length;
  const currentPhaseIndex = ARTIFACT_ORDER.findIndex(type => getPhaseStatus(type) === "current");

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap">
          Phase {currentPhaseIndex + 1} of {ARTIFACT_ORDER.length}
        </span>
        <div className="flex items-center">
          {ARTIFACT_ORDER.map((type, index) => {
            const status = getPhaseStatus(type);
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                        status === "complete" && "bg-emerald-500 text-white",
                        status === "current" && "bg-blue-500/20 text-blue-600 border-2 border-blue-500",
                        status === "pending" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {status === "complete" ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    {index < ARTIFACT_ORDER.length - 1 && (
                      <div
                        className={cn(
                          "w-2 h-0.5",
                          status === "complete" ? "bg-emerald-500" : "bg-muted"
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
