/**
 * Centralized error handling utilities
 * Provides consistent error handling patterns across the codebase
 */

import { toast } from "sonner";
import { PostgrestError } from "@supabase/supabase-js";

/**
 * Common error types in the application
 */
export type AppErrorType =
  | "session_expired"
  | "network"
  | "validation"
  | "not_found"
  | "permission"
  | "rate_limit"
  | "server"
  | "unknown";

/**
 * Application error with type information
 */
export interface AppError {
  type: AppErrorType;
  message: string;
  originalError?: unknown;
  canRetry: boolean;
}

/**
 * Default error messages by type
 */
const DEFAULT_MESSAGES: Record<AppErrorType, string> = {
  session_expired: "Session expired. Please log in again.",
  network: "Network error. Please check your connection.",
  validation: "Invalid input. Please check your data.",
  not_found: "The requested item was not found.",
  permission: "You don't have permission to perform this action.",
  rate_limit: "Too many requests. Please wait a moment.",
  server: "Server error. Please try again later.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * Create an AppError from various error types
 */
export function createAppError(error: unknown, fallbackType: AppErrorType = "unknown"): AppError {
  // Handle Postgrest errors (Supabase)
  if (isPostgrestError(error)) {
    return fromPostgrestError(error);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return fromStandardError(error, fallbackType);
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      type: fallbackType,
      message: error,
      canRetry: fallbackType !== "validation" && fallbackType !== "permission",
    };
  }

  // Unknown error shape
  return {
    type: "unknown",
    message: DEFAULT_MESSAGES.unknown,
    originalError: error,
    canRetry: true,
  };
}

/**
 * Check if error is a Postgrest error
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "details" in error
  );
}

/**
 * Convert Postgrest error to AppError
 */
function fromPostgrestError(error: PostgrestError): AppError {
  // Map common Postgrest error codes
  switch (error.code) {
    case "23505": // Unique violation
      return {
        type: "validation",
        message: "This item already exists.",
        originalError: error,
        canRetry: false,
      };
    case "23503": // Foreign key violation
      return {
        type: "validation",
        message: "Referenced item does not exist.",
        originalError: error,
        canRetry: false,
      };
    case "42501": // Insufficient privilege
      return {
        type: "permission",
        message: DEFAULT_MESSAGES.permission,
        originalError: error,
        canRetry: false,
      };
    case "PGRST301": // Row not found
      return {
        type: "not_found",
        message: DEFAULT_MESSAGES.not_found,
        originalError: error,
        canRetry: false,
      };
    default:
      return {
        type: "server",
        message: error.message || DEFAULT_MESSAGES.server,
        originalError: error,
        canRetry: true,
      };
  }
}

/**
 * Convert standard Error to AppError
 */
function fromStandardError(error: Error, fallbackType: AppErrorType): AppError {
  const message = error.message.toLowerCase();

  // Detect network errors
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("offline") ||
    error.name === "TypeError"
  ) {
    return {
      type: "network",
      message: DEFAULT_MESSAGES.network,
      originalError: error,
      canRetry: true,
    };
  }

  // Detect timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return {
      type: "network",
      message: "Request timed out. Please try again.",
      originalError: error,
      canRetry: true,
    };
  }

  return {
    type: fallbackType,
    message: error.message || DEFAULT_MESSAGES[fallbackType],
    originalError: error,
    canRetry: fallbackType !== "validation" && fallbackType !== "permission",
  };
}

/**
 * Handle session expiry - shows toast and redirects to auth
 */
export function handleSessionExpired(): void {
  toast.error(DEFAULT_MESSAGES.session_expired);
  window.location.href = "/auth";
}

/**
 * Show error toast with consistent messaging
 */
export function showErrorToast(error: AppError | string): void {
  const message = typeof error === "string" ? error : error.message;
  toast.error(message);
}

/**
 * Show success toast for CRUD operations
 */
export function showSuccessToast(
  operation: "create" | "update" | "delete" | "approve" | "custom",
  entityName: string,
  customMessage?: string
): void {
  const messages: Record<typeof operation, string> = {
    create: `${entityName} created!`,
    update: `${entityName} updated!`,
    delete: `${entityName} deleted`,
    approve: `${entityName} approved!`,
    custom: customMessage || "Success!",
  };

  toast.success(messages[operation]);
}

/**
 * Result type for operations that can fail
 * Provides a type-safe way to handle success/failure
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a success result
 */
export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function err<E = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Wrap an async operation with standardized error handling
 * Returns a Result type instead of throwing
 *
 * @example
 * ```ts
 * const result = await tryCatch(async () => {
 *   return await supabase.from("projects").select().single();
 * });
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   showErrorToast(result.error);
 * }
 * ```
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  fallbackType: AppErrorType = "unknown"
): Promise<Result<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(createAppError(error, fallbackType));
  }
}
