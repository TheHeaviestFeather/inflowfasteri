/**
 * Type definitions for database entities
 * Single source of truth for artifact types and statuses
 */

/**
 * All valid artifact types in the instructional design pipeline
 */
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

/**
 * Valid artifact lifecycle statuses
 */
export type ArtifactStatus = "draft" | "approved" | "stale";

/**
 * Project mode determines the artifact pipeline
 */
export type ProjectMode = "standard" | "quick";

/**
 * Project lifecycle status
 */
export type ProjectStatus = "active" | "archived" | "completed";

/**
 * Message role for chat messages
 */
export type MessageRole = "user" | "assistant";

/**
 * Project entity representing a design project
 */
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  mode: ProjectMode;
  status: ProjectStatus;
  current_stage: string | null;
  prompt_version: string;
  created_at: string;
  updated_at: string;
}

/**
 * Message entity for chat history
 */
export interface Message {
  id: string;
  project_id: string;
  role: MessageRole;
  content: string;
  prompt_version: string | null;
  sequence: number;
  created_at: string;
}

/**
 * Artifact entity for design deliverables
 */
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

/**
 * Human-readable labels for artifact types
 */
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

/**
 * Full pipeline order for Standard mode
 */
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

/**
 * Quick mode artifact subset (Contract → Blueprint → Audit → Report)
 */
export const QUICK_MODE_ARTIFACTS: ArtifactType[] = [
  "phase_1_contract",
  "design_blueprint",
  "final_audit",
  "performance_recommendation_report",
];

/**
 * Set of all valid artifact types for O(1) validation
 */
export const VALID_ARTIFACT_TYPES: ReadonlySet<ArtifactType> = new Set(ARTIFACT_ORDER);

/**
 * Check if an artifact type is skipped in quick mode
 */
export const isSkippedInQuickMode = (type: ArtifactType): boolean => {
  return !QUICK_MODE_ARTIFACTS.includes(type);
};

/**
 * Check if a string is a valid artifact type
 */
export const isValidArtifactType = (type: string): type is ArtifactType => {
  return VALID_ARTIFACT_TYPES.has(type as ArtifactType);
};
