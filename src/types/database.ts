/**
 * Type definitions for database entities
 * Single source of truth for artifact types and statuses
 */

/**
 * SINGLE SOURCE OF TRUTH: All artifact types in pipeline order
 * Adding a new type? Just add it here - everything else derives from this.
 */
export const ARTIFACT_TYPES = [
  "phase_1_contract",
  "discovery_report",
  "learner_persona",
  "design_strategy",
  "design_blueprint",
  "scenario_bank",
  "assessment_kit",
  "final_audit",
  "performance_recommendation_report",
] as const;

/**
 * Derived type from the const array - no duplication needed
 */
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * Valid artifact lifecycle statuses
 */
export const ARTIFACT_STATUSES = ["draft", "approved", "stale"] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

/**
 * Project mode determines the artifact pipeline
 */
export const PROJECT_MODES = ["standard", "quick"] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];

/**
 * Project lifecycle status
 */
export const PROJECT_STATUSES = ["active", "archived", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Message role for chat messages
 */
export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

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
 * Uses satisfies to ensure all types are covered
 */
export const ARTIFACT_LABELS = {
  phase_1_contract: "Phase 1 Contract",
  discovery_report: "Discovery Report",
  learner_persona: "Learner Persona",
  design_strategy: "Design Strategy",
  design_blueprint: "Design Blueprint",
  scenario_bank: "Scenario Bank",
  assessment_kit: "Assessment Kit",
  final_audit: "Final Audit",
  performance_recommendation_report: "Performance Report",
} as const satisfies Record<ArtifactType, string>;

/**
 * Full pipeline order for Standard mode (derived from ARTIFACT_TYPES)
 */
export const ARTIFACT_ORDER: readonly ArtifactType[] = ARTIFACT_TYPES;

/**
 * Quick mode artifact subset (Contract → Blueprint → Audit → Report)
 */
export const QUICK_MODE_ARTIFACTS: readonly ArtifactType[] = [
  "phase_1_contract",
  "design_blueprint",
  "final_audit",
  "performance_recommendation_report",
];

/**
 * Set of all valid artifact types for O(1) validation
 */
export const VALID_ARTIFACT_TYPES: ReadonlySet<ArtifactType> = new Set(ARTIFACT_TYPES);

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
