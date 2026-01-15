/**
 * Input validation utilities for the chat edge function
 */

import { MAX_MESSAGES, MAX_CONTENT_LENGTH } from "./constants.ts";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  project_id?: string;
}

export interface ValidationError {
  error: string;
  status: number;
}

/**
 * Dangerous patterns to detect in content
 * These are sanitized or rejected to prevent injection attacks
 */
const DANGEROUS_PATTERNS = {
  // Null bytes can truncate strings in some systems
  nullByte: /\x00/,
  // Control characters (except common whitespace)
  controlChars: /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/,
  // Script tags and event handlers (XSS vectors)
  scriptTags: /<script[\s>]/i,
  eventHandlers: /\s+on\w+\s*=/i,
  // JavaScript protocol
  jsProtocol: /javascript\s*:/i,
  // Data URLs with executable content
  dataUrl: /data\s*:\s*text\/html/i,
};

/**
 * Sanitize content by removing dangerous characters
 * Returns sanitized content or null if content is irreparably dangerous
 */
export function sanitizeContent(content: string): string | null {
  // Reject null bytes outright - they indicate malicious intent
  if (DANGEROUS_PATTERNS.nullByte.test(content)) {
    return null;
  }

  // Remove control characters (keep tabs, newlines, carriage returns)
  let sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Escape potential XSS vectors in stored content
  // Note: AI will see escaped versions, which is intentional
  sanitized = sanitized
    .replace(/<script/gi, "&lt;script")
    .replace(/javascript\s*:/gi, "javascript&#58;");

  return sanitized;
}

/**
 * Check if content contains suspicious patterns worth logging
 */
export function detectSuspiciousContent(content: string): string[] {
  const flags: string[] = [];

  if (DANGEROUS_PATTERNS.scriptTags.test(content)) {
    flags.push("script_tag");
  }
  if (DANGEROUS_PATTERNS.eventHandlers.test(content)) {
    flags.push("event_handler");
  }
  if (DANGEROUS_PATTERNS.jsProtocol.test(content)) {
    flags.push("js_protocol");
  }
  if (DANGEROUS_PATTERNS.dataUrl.test(content)) {
    flags.push("data_url");
  }
  if (DANGEROUS_PATTERNS.controlChars.test(content)) {
    flags.push("control_chars");
  }

  return flags;
}

/**
 * UUID regex for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Result from request body validation
 */
export interface RequestValidationResult {
  error?: ValidationError;
  sanitizedMessages?: ChatMessage[];
  securityFlags?: string[];
}

/**
 * Validate the chat request body
 * Returns sanitized messages if valid, error otherwise
 */
export function validateRequestBody(body: unknown): RequestValidationResult {
  if (!body || typeof body !== "object") {
    return { error: { error: "Invalid request body", status: 400 } };
  }

  const { messages, project_id } = body as Record<string, unknown>;

  // Validate project_id format if provided
  if (project_id !== undefined) {
    if (typeof project_id !== "string" || !UUID_REGEX.test(project_id)) {
      return { error: { error: "Invalid project ID format", status: 400 } };
    }
  }

  // Validate messages array
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { error: { error: "Invalid messages format", status: 400 } };
  }

  if (messages.length > MAX_MESSAGES) {
    return { error: { error: `Maximum ${MAX_MESSAGES} messages allowed`, status: 400 } };
  }

  // Validate and sanitize each message
  const sanitizedMessages: ChatMessage[] = [];
  const allFlags: string[] = [];

  for (const msg of messages) {
    const result = validateMessage(msg);
    if (result.error) {
      return { error: result.error };
    }

    // Collect security flags for logging
    if (result.flags && result.flags.length > 0) {
      allFlags.push(...result.flags);
    }

    // Build sanitized message
    const { role } = msg as Record<string, unknown>;
    sanitizedMessages.push({
      role: role as "user" | "assistant" | "system",
      content: result.sanitizedContent!,
    });
  }

  return {
    sanitizedMessages,
    securityFlags: allFlags.length > 0 ? allFlags : undefined,
  };
}

/**
 * Validation result with sanitized content
 */
export interface MessageValidationResult {
  error?: ValidationError;
  sanitizedContent?: string;
  flags?: string[];
}

/**
 * Validate a single chat message
 * Returns sanitized content and any security flags detected
 */
function validateMessage(msg: unknown): MessageValidationResult {
  if (!msg || typeof msg !== "object") {
    return { error: { error: "Each message must be an object", status: 400 } };
  }

  const { role, content } = msg as Record<string, unknown>;

  if (!role || !content) {
    return { error: { error: "Each message must have role and content", status: 400 } };
  }

  if (!["user", "assistant", "system"].includes(role as string)) {
    return { error: { error: "Invalid message role", status: 400 } };
  }

  if (typeof content !== "string") {
    return { error: { error: "Message content must be a string", status: 400 } };
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return { error: { error: `Message content must be under ${MAX_CONTENT_LENGTH} characters`, status: 400 } };
  }

  // Detect suspicious patterns (for logging)
  const flags = detectSuspiciousContent(content);

  // Sanitize content - remove dangerous characters
  const sanitizedContent = sanitizeContent(content);

  if (sanitizedContent === null) {
    return { error: { error: "Message contains invalid characters", status: 400 } };
  }

  return { sanitizedContent, flags };
}

/**
 * Validate JWT token shape
 */
export function isValidJwtShape(token: string): boolean {
  return token.split(".").length === 3;
}
