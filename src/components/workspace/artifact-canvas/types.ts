import { ArtifactType } from "@/types/database";

export interface DeliverableBanner {
  type: ArtifactType;
  isNew: boolean;
  isStale?: boolean;
  timestamp: number;
}

export type PhaseStatus = "complete" | "active" | "empty" | "skipped" | "pending";

export const SHORT_LABELS: Record<ArtifactType, string> = {
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

// Map pipeline stage names to artifact types
// Supports various naming conventions the AI might use
export const STAGE_TO_ARTIFACT: Record<string, ArtifactType> = {
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
