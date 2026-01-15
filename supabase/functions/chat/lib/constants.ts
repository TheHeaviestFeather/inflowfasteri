/**
 * Constants for the chat edge function
 */

export const MAX_MESSAGES = 100;
export const MAX_CONTENT_LENGTH = 50000;
export const RATE_LIMIT_MAX_REQUESTS = 30;
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const CURRENT_PROMPT_VERSION = "v2.0";
export const CACHE_TTL_HOURS = 24;

/**
 * Valid artifact types in pipeline order
 */
export const ARTIFACT_SEQUENCE = [
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

export type ArtifactType = (typeof ARTIFACT_SEQUENCE)[number];
