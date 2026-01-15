/**
 * Authentication utilities for edge functions
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./logger.ts";
import { isValidJwtShape } from "./validation.ts";

export interface AuthResult {
  success: true;
  userId: string;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

/**
 * Authenticate user from request and create Supabase clients
 */
export async function authenticateRequest(
  req: Request,
  requestId: string
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    log("warn", "Missing authorization header", { requestId });
    return { success: false, error: "Missing authorization", status: 401 };
  }

  const tokenPart = authHeader.replace(/^Bearer\s+/i, "").trim();
  
  if (!isValidJwtShape(tokenPart)) {
    log("warn", "Invalid token shape", { requestId });
    return { success: false, error: "Invalid token", status: 401 };
  }

  // Create clients
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${tokenPart}` } },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate user
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  
  if (authError || !user) {
    log("warn", "Authentication failed", { requestId });
    return { success: false, error: "Unauthorized", status: 401 };
  }

  log("info", "Request started", { requestId, userId: user.id });

  return {
    success: true,
    userId: user.id,
    userClient,
    serviceClient,
  };
}

/**
 * Check rate limit for user
 */
export async function checkRateLimit(
  serviceClient: SupabaseClient,
  userId: string,
  maxRequests: number,
  windowSeconds: number,
  requestId: string
): Promise<{ allowed: boolean; error?: string; status?: number }> {
  const { data: isAllowed, error: rateLimitError } = await serviceClient.rpc("check_rate_limit", {
    p_user_id: userId,
    p_endpoint: "chat",
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (rateLimitError) {
    log("error", "Rate limit check failed", { requestId, error: rateLimitError.message });
    return { allowed: false, error: "Service temporarily unavailable.", status: 503 };
  }

  if (!isAllowed) {
    log("warn", "Rate limit exceeded", { requestId });
    return { allowed: false, error: "Rate limit exceeded. Please wait a moment.", status: 429 };
  }

  return { allowed: true };
}

/**
 * Check and use credit for user
 */
export async function checkAndUseCredit(
  serviceClient: SupabaseClient,
  userId: string,
  requestId: string
): Promise<{ hasCredits: boolean; error?: string; status?: number }> {
  const { data: hasCredits, error: creditError } = await serviceClient.rpc("check_and_use_credit", {
    p_user_id: userId,
  });

  if (creditError) {
    log("error", "Credit check failed", { requestId, error: creditError.message });
    return { hasCredits: false, error: "Service temporarily unavailable.", status: 503 };
  }

  if (!hasCredits) {
    log("warn", "Credits exhausted", { requestId, userId });
    return { hasCredits: false, error: "You've used all your free credits. Upgrade to continue.", status: 402 };
  }

  return { hasCredits: true };
}

/**
 * Validate project ownership
 */
export async function validateProjectAccess(
  userClient: SupabaseClient,
  projectId: string,
  requestId: string
): Promise<{ hasAccess: boolean; error?: string; status?: number }> {
  const { data: projectData, error: projectError } = await userClient
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectData) {
    log("warn", "Project not found or access denied", { requestId });
    return { hasAccess: false, error: "Project not found or access denied", status: 403 };
  }

  return { hasAccess: true };
}
