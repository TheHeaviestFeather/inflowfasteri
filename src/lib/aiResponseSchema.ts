/**
 * Strict AI Response Schema
 * Single source of truth for AI output format
 * This replaces the need for multiple parsing strategies
 */

import { z } from "zod";

/**
 * Valid artifact types as a Zod enum
 */
const ArtifactTypeEnum = z.enum([
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

/**
 * Artifact schema - structured deliverable content
 */
const ArtifactSchema = z.object({
  type: ArtifactTypeEnum,
  title: z.string().min(1).max(200),
  content: z.string().min(20),
  status: z.enum(["draft", "ready_for_review"]).default("draft"),
});

/**
 * Session state schema - pipeline tracking
 */
const SessionStateSchema = z.object({
  mode: z.enum(["STANDARD", "QUICK"]),
  pipeline_stage: z.string(),
  threshold_percent: z.number().min(0).max(100).optional(),
});

/**
 * Complete AI Response schema
 * The AI MUST respond with this exact JSON structure
 */
export const AIResponseSchema = z.object({
  message: z.string().min(1).describe("Natural language response to the user"),
  artifact: ArtifactSchema.optional().describe("Structured deliverable if generating content"),
  state: SessionStateSchema.optional().describe("Pipeline state update"),
  next_actions: z.array(z.string()).optional().describe("Suggested next steps for user"),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;
export type AIArtifact = z.infer<typeof ArtifactSchema>;
export type AISessionState = z.infer<typeof SessionStateSchema>;

/**
 * Parse AI response with validation
 * Returns parsed response or null with error details
 */
export function parseAIResponse(raw: string): {
  success: boolean;
  data?: AIResponse;
  error?: string;
  rawContent?: string;
} {
  // First, try to extract JSON from the response
  let jsonString = raw.trim();
  
  // Handle case where response is wrapped in markdown code block
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }
  
  // Handle case where response has text before/after JSON
  const jsonObjectMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    jsonString = jsonObjectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonString);
    const validated = AIResponseSchema.safeParse(parsed);
    
    if (validated.success) {
      return { success: true, data: validated.data };
    } else {
      return {
        success: false,
        error: validated.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        rawContent: raw,
      };
    }
  } catch (e) {
    return {
      success: false,
      error: `JSON parse error: ${(e as Error).message}`,
      rawContent: raw,
    };
  }
}

/**
 * Schema as a string for inclusion in system prompts
 */
export const AI_RESPONSE_SCHEMA_PROMPT = `
You MUST respond with valid JSON matching this exact schema:

{
  "message": "Your natural language response to the user",
  "artifact": {
    "type": "one of: phase_1_contract, discovery_report, learner_persona, design_strategy, design_blueprint, scenario_bank, assessment_kit, final_audit, performance_recommendation_report",
    "title": "Title of the deliverable",
    "content": "The full markdown content of the deliverable"
  },
  "state": {
    "mode": "STANDARD or QUICK",
    "pipeline_stage": "current stage name"
  },
  "next_actions": ["suggested next step 1", "suggested next step 2"]
}

Rules:
- "message" is REQUIRED - always include a natural language response
- "artifact" is OPTIONAL - only include when generating a deliverable
- "state" is OPTIONAL - only include when pipeline state changes
- "next_actions" is OPTIONAL - include to guide the user
- Do NOT include any text outside the JSON object
- Do NOT wrap the JSON in markdown code blocks
`;
