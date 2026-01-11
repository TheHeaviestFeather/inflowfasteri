/**
 * PII Redaction utilities
 * Use these before logging any user-generated content
 */

/**
 * Redact common PII patterns from text
 */
export function redactPII(text: string): string {
  if (!text) return text;
  
  return text
    // Email addresses
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, '[EMAIL]')
    // Phone numbers (various formats)
    .replace(/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]')
    // SSN
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    // Credit card numbers (basic pattern)
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
    // IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
    // URLs with potential auth tokens
    .replace(/https?:\/\/[^\s]*(?:token|key|auth|password|secret)[^\s]*/gi, '[URL_WITH_CREDENTIALS]');
}

/**
 * Redact PII from an object's string values (shallow)
 */
export function redactObjectPII<T extends Record<string, unknown>>(obj: T): T {
  const redacted = { ...obj };
  for (const key of Object.keys(redacted)) {
    if (typeof redacted[key] === 'string') {
      (redacted as Record<string, unknown>)[key] = redactPII(redacted[key] as string);
    }
  }
  return redacted;
}

/**
 * Truncate content for logging (prevents huge log entries)
 */
export function truncateForLog(text: string, maxLength: number = 500): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `... [truncated ${text.length - maxLength} chars]`;
}
