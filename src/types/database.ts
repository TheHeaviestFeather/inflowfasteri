export type ArtifactType =
  | "phase_1_contract"
  | "discovery_report"
  | "learner_persona"
  | "design_strategy"
  | "design_blueprint"
  | "scenario_bank"
  | "assessment_kit"
  | "final_audit"
  | "performance_recommendation_report";

export type ArtifactStatus = "draft" | "approved" | "stale";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  mode: "standard" | "quick";
  status: "active" | "archived" | "completed";
  current_stage: string | null;
  prompt_version: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  prompt_version: string | null;
  sequence: number;
  created_at: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  artifact_type: ArtifactType;
  content: string;
  status: ArtifactStatus;
  version: number;
  prompt_version: string | null;
  updated_by_message_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  stale_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  phase_1_contract: "Phase 1 Contract",
  discovery_report: "Discovery Report",
  learner_persona: "Learner Persona",
  design_strategy: "Design Strategy",
  design_blueprint: "Design Blueprint",
  scenario_bank: "Scenario Bank",
  assessment_kit: "Assessment Kit",
  final_audit: "Final Audit",
  performance_recommendation_report: "Performance Report",
};

// Full pipeline for Standard mode
export const ARTIFACT_ORDER: ArtifactType[] = [
  "phase_1_contract",
  "discovery_report",
  "learner_persona",
  "design_strategy",
  "design_blueprint",
  "scenario_bank",
  "assessment_kit",
  "final_audit",
  "performance_recommendation_report",
];

// Quick mode only uses these phases
export const QUICK_MODE_ARTIFACTS: ArtifactType[] = [
  "phase_1_contract",
  "design_blueprint",
  "final_audit",
];

// Check if an artifact is skipped in quick mode
export const isSkippedInQuickMode = (type: ArtifactType): boolean => {
  return !QUICK_MODE_ARTIFACTS.includes(type);
};
