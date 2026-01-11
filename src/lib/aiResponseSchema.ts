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
 * Clean and extract JSON from AI response
 * Handles various malformed response patterns
 */
function extractJsonString(raw: string): string {
  let jsonString = raw.trim();
  
  // Remove markdown code block wrappers (```json or just ```)
  // Handle: ```json\n{...}\n``` or ```\n{...}\n``` or ```{...}```
  const codeBlockMatch = jsonString.match(/^```(?:json)?[\s\n]*([\s\S]*?)```$/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }
  
  // If response starts with ``` (with or without json), strip it
  if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```(?:json)?[\s\n]*/, '').trim();
  }
  
  // If ends with ```, strip it
  if (jsonString.endsWith('```')) {
    jsonString = jsonString.replace(/```$/, '').trim();
  }
  
  // Handle case where response starts with "json\n" or "json{" (markdown leftover)
  if (jsonString.startsWith('json\n') || jsonString.startsWith('json{') || jsonString.startsWith('json "')) {
    jsonString = jsonString.replace(/^json[\s\n]*/, '').trim();
  }
  
  // If the response doesn't start with {, try to find the JSON object
  if (!jsonString.startsWith('{')) {
    // Check if it starts with "message" (missing opening brace)
    if (jsonString.startsWith('"message"') || jsonString.startsWith("'message'")) {
      jsonString = '{' + jsonString;
    } else {
      // Try to extract JSON object from anywhere in the string
      const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonString = jsonObjectMatch[0];
      }
    }
  }
  
  // If response doesn't end with }, find the last } and truncate
  if (!jsonString.endsWith('}')) {
    const lastBrace = jsonString.lastIndexOf('}');
    if (lastBrace > 0) {
      jsonString = jsonString.substring(0, lastBrace + 1);
    }
  }
  
  return jsonString;
}

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
  const jsonString = extractJsonString(raw);

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
    // If parsing fails, try to repair common issues
    const repairAttempt = attemptJsonRepair(jsonString);
    if (repairAttempt) {
      try {
        const parsed = JSON.parse(repairAttempt);
        const validated = AIResponseSchema.safeParse(parsed);
        if (validated.success) {
          return { success: true, data: validated.data };
        }
      } catch {
        // Repair attempt also failed
      }
    }
    
    return {
      success: false,
      error: `JSON parse error: ${(e as Error).message}`,
      rawContent: raw,
    };
  }
}

/**
 * Attempt to repair common JSON issues
 */
function attemptJsonRepair(jsonString: string): string | null {
  try {
    // Try to fix unescaped newlines in string values
    // This is a common issue with AI-generated JSON
    let repaired = jsonString;
    
    // Count braces to check balance
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    
    // Add missing closing braces
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }
    
    // Try to find and close unclosed strings by looking for common patterns
    // Check if we have an unclosed "content" field
    const contentMatch = repaired.match(/"content"\s*:\s*"([^"]*(?:\\.[^"]*)*)$/);
    if (contentMatch) {
      // Content string is unclosed, try to close it
      repaired += '", "status": "draft"}';
      
      // Also close the outer objects
      const stillOpenBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
      if (stillOpenBraces > 0) {
        repaired += '}'.repeat(stillOpenBraces);
      }
    }
    
    return repaired;
  } catch {
    return null;
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
