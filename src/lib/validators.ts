/**
 * Runtime validators for Supabase responses
 * Provides type safety at runtime to catch schema drift
 */

import { z } from "zod";
import { validatorLogger } from "@/lib/logger";

// Artifact Types enum for validation
const ArtifactTypeSchema = z.enum([
  "phase_1_contract",
  "discovery_report",
  "learner_persona",
  "design_strategy",
  "design_blueprint",
  "scenario_bank",
  "assessment_kit",
  "final_audit",
  "performance_recommendation_report",
]);

// Artifact Status enum for validation
const ArtifactStatusSchema = z.enum(["draft", "approved", "stale"]);

// Project Mode enum for validation
const ProjectModeSchema = z.enum(["standard", "quick"]);

// Project Status enum for validation
const ProjectStatusSchema = z.enum(["active", "archived", "completed"]);

// Message Role enum for validation
const MessageRoleSchema = z.enum(["user", "assistant"]);

/**
 * Project schema validator
 */
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  client_name: z.string().nullable(),
  mode: ProjectModeSchema,
  status: ProjectStatusSchema,
  current_stage: z.string().nullable(),
  prompt_version: z.string().nullable().transform((v) => v ?? ""),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

/**
 * Message schema validator
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  prompt_version: z.string().nullable(),
  sequence: z.number().int(),
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Artifact schema validator
 */
export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  artifact_type: ArtifactTypeSchema,
  content: z.string(),
  status: ArtifactStatusSchema,
  version: z.number().int().min(1),
  prompt_version: z.string().nullable(),
  updated_by_message_id: z.string().uuid().nullable(),
  approved_at: z.string().datetime({ offset: true }).nullable(),
  approved_by: z.string().uuid().nullable(),
  stale_reason: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

// Array validators
export const ProjectsArraySchema = z.array(ProjectSchema);
export const MessagesArraySchema = z.array(MessageSchema);
export const ArtifactsArraySchema = z.array(ArtifactSchema);

// Type exports from schemas
export type ValidatedProject = z.infer<typeof ProjectSchema>;
export type ValidatedMessage = z.infer<typeof MessageSchema>;
export type ValidatedArtifact = z.infer<typeof ArtifactSchema>;

/**
 * Safe parse helper that logs validation errors in development
 * Returns parsed data or null if validation fails
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (import.meta.env.DEV) {
      validatorLogger.warn(`${context || "Validation"} failed`, { issues: result.error.issues });
    }
    return null;
  }
  return result.data;
}

/**
 * Parse with fallback - returns parsed data or original data if validation fails
 * Useful for graceful degradation when schema might be out of sync
 */
export function parseWithFallback<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (import.meta.env.DEV) {
      validatorLogger.warn(`${context || "Validation"} failed, using fallback`, { issues: result.error.issues });
    }
    return data as T;
  }
  return result.data;
}

/**
 * Validate array of items, filtering out invalid ones
 * Returns only valid items, logs invalid ones in development
 */
export function parseArrayFiltered<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  context?: string
): T[] {
  const valid: T[] = [];
  const invalid: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = schema.safeParse(data[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push(i);
    }
  }

  if (invalid.length > 0 && import.meta.env.DEV) {
    validatorLogger.warn(`${context || "Array"}: ${invalid.length} invalid items`, { indices: invalid });
  }

  return valid;
}
