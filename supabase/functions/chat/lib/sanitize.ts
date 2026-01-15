/**
 * Response sanitization utilities
 */

/**
 * Sanitize AI response by stripping markdown code blocks
 * This is a safety net for when the AI ignores the "no code blocks" instruction
 */
export function sanitizeJsonResponse(raw: string): string {
  let cleaned = raw.trim();

  // Remove ```json ... ``` or ``` ... ``` wrappers (with content between)
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // If starts with ``` (with or without json, possibly unclosed), strip it
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?[\s\n]*/, "").trim();
  }

  // If ends with ```, strip it
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```$/, "").trim();
  }

  // Handle case where response starts with "json\n{" or "json{" (markdown artifact)
  if (cleaned.startsWith("json\n") || cleaned.startsWith("json{")) {
    cleaned = cleaned.replace(/^json[\s\n]*/, "").trim();
  }

  // If response doesn't start with {, try to find JSON object
  if (!cleaned.startsWith("{")) {
    // Check if it starts with "message" (missing opening brace)
    if (cleaned.startsWith('"message"') || cleaned.startsWith("'message'")) {
      cleaned = "{" + cleaned;
    } else {
      // Extract first JSON object from the string
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }
  }

  // Ensure response ends with }
  if (!cleaned.endsWith("}")) {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    }
  }

  return cleaned;
}
