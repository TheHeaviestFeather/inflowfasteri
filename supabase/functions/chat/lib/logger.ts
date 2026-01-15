/**
 * Structured logging utilities for edge functions
 */

/**
 * Redact PII from text for safe logging
 */
export function redactPII(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, "[EMAIL]")
    .replace(/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Structured log entry
 */
export function log(
  level: "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>
): void {
  const safeContext = context
    ? Object.fromEntries(
        Object.entries(context).map(([k, v]) => [k, typeof v === "string" ? redactPII(v) : v])
      )
    : {};

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeContext,
  };
  console.log(JSON.stringify(logEntry));
}
