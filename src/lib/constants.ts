/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// API Configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const CHAT_ENDPOINT = `${SUPABASE_URL}/functions/v1/chat`;

// Timeouts (in milliseconds)
export const STREAM_TIMEOUT_MS = 30_000; // 30s without data = timeout
export const RETRY_BASE_DELAY_MS = 1_000; // Base delay for exponential backoff
export const MAX_RETRY_DELAY_MS = 30_000; // Max delay for retry

// Message Limits
export const MAX_MESSAGE_LENGTH = 50_000;
export const MAX_MESSAGES_PER_REQUEST = 100;
export const MIN_STREAMING_PREVIEW_LENGTH = 50;

// Artifact Parser
export const MIN_ARTIFACT_CONTENT_LENGTH = 20;

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_MESSAGES_FETCH = 200;
export const MAX_ARTIFACTS_FETCH = 50;

// Rate Limiting
export const RATE_LIMIT_REQUESTS = 30;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

// Retry Configuration
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @returns Delay in milliseconds with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = RETRY_BASE_DELAY_MS,
  maxDelay: number = MAX_RETRY_DELAY_MS
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(cappedDelay + jitter);
}
