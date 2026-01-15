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
 * UUID regex for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate the chat request body
 */
export function validateRequestBody(body: unknown): ValidationError | null {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body", status: 400 };
  }

  const { messages, project_id } = body as Record<string, unknown>;

  // Validate project_id format if provided
  if (project_id !== undefined) {
    if (typeof project_id !== "string" || !UUID_REGEX.test(project_id)) {
      return { error: "Invalid project ID format", status: 400 };
    }
  }

  // Validate messages array
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { error: "Invalid messages format", status: 400 };
  }

  if (messages.length > MAX_MESSAGES) {
    return { error: `Maximum ${MAX_MESSAGES} messages allowed`, status: 400 };
  }

  // Validate each message
  for (const msg of messages) {
    const msgError = validateMessage(msg);
    if (msgError) return msgError;
  }

  return null;
}

/**
 * Validate a single chat message
 */
function validateMessage(msg: unknown): ValidationError | null {
  if (!msg || typeof msg !== "object") {
    return { error: "Each message must be an object", status: 400 };
  }

  const { role, content } = msg as Record<string, unknown>;

  if (!role || !content) {
    return { error: "Each message must have role and content", status: 400 };
  }

  if (!["user", "assistant", "system"].includes(role as string)) {
    return { error: "Invalid message role", status: 400 };
  }

  if (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH) {
    return { error: `Message content must be under ${MAX_CONTENT_LENGTH} characters`, status: 400 };
  }

  return null;
}

/**
 * Validate JWT token shape
 */
export function isValidJwtShape(token: string): boolean {
  return token.split(".").length === 3;
}
