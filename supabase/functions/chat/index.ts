/**
 * Chat Edge Function - Refactored for maintainability
 *
 * This is the main entry point that orchestrates:
 * - Authentication and rate limiting
 * - Request validation
 * - System prompt + pipeline context
 * - AI gateway streaming
 * - Response caching
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Internal modules
import { getCorsHeaders, handleCorsPreflightRequest } from "./lib/cors.ts";
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS } from "./lib/constants.ts";
import { generateRequestId, log } from "./lib/logger.ts";
import { validateRequestBody, ChatRequestBody } from "./lib/validation.ts";
import {
  authenticateRequest,
  checkRateLimit,
  checkAndUseCredit,
  validateProjectAccess,
} from "./lib/auth.ts";
import { generateCacheKey, getCachedResponse, streamFromCache } from "./lib/cache.ts";
import { sanitizeJsonResponse } from "./lib/sanitize.ts";
import { buildPipelineContext } from "./lib/pipeline.ts";
import { getSystemPrompt } from "./lib/system-prompt.ts";
import { streamAIResponse } from "./lib/ai-gateway.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const requestId = req.headers.get("X-Request-ID") || generateRequestId();
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    // 1. Authenticate user
    const authResult = await authenticateRequest(req, requestId);
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, userClient, serviceClient } = authResult;

    // 2. Check rate limit
    const rateLimitResult = await checkRateLimit(
      serviceClient,
      userId,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_SECONDS,
      requestId
    );
    if (!rateLimitResult.allowed) {
      const headers: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
      if (rateLimitResult.status === 503) headers["Retry-After"] = "10";
      return new Response(
        JSON.stringify({ error: rateLimitResult.error }),
        { status: rateLimitResult.status!, headers }
      );
    }

    // 3. Check credits
    const creditResult = await checkAndUseCredit(serviceClient, userId, requestId);
    if (!creditResult.hasCredits) {
      const headers: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
      if (creditResult.status === 503) headers["Retry-After"] = "10";
      return new Response(
        JSON.stringify({ error: creditResult.error }),
        { status: creditResult.status!, headers }
      );
    }

    // 4. Parse and validate request body
    const body = await req.json() as ChatRequestBody;
    const validationError = validateRequestBody(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError.error }),
        { status: validationError.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validate project access if project_id provided
    if (body.project_id) {
      const accessResult = await validateProjectAccess(userClient, body.project_id, requestId);
      if (!accessResult.hasAccess) {
        return new Response(
          JSON.stringify({ error: accessResult.error }),
          { status: accessResult.status!, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Get system prompt and build pipeline context
    const { prompt: systemPrompt, version: promptVersion } = await getSystemPrompt(serviceClient);
    
    let systemPromptFinal = systemPrompt;
    if (body.project_id) {
      const pipelineContext = await buildPipelineContext(serviceClient, body.project_id, requestId);
      systemPromptFinal = `${systemPrompt}${pipelineContext}`;
    }

    // 7. Check cache
    const model = "google/gemini-2.5-flash";
    const promptHash = await generateCacheKey(systemPromptFinal, body.messages, model);
    const cachedResponse = await getCachedResponse(serviceClient, promptHash, requestId);

    if (cachedResponse) {
      const sanitized = sanitizeJsonResponse(cachedResponse);
      return new Response(streamFromCache(sanitized), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "X-Request-ID": requestId,
          "X-Prompt-Version": promptVersion,
          "X-Cache-Status": "HIT",
        },
      });
    }

    // 8. Call AI gateway
    const aiResponse = await streamAIResponse({
      model,
      systemPrompt: systemPromptFinal,
      messages: body.messages,
      promptVersion,
      promptHash,
      userId,
      projectId: body.project_id ?? null,
      requestId,
      startTime,
      serviceClient,
    });

    if (!aiResponse) {
      // AI gateway returned error status - return appropriate error
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return streaming response with headers
    return new Response(aiResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Request-ID": requestId,
        "X-Prompt-Version": promptVersion,
        "X-Cache-Status": "MISS",
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log("error", "Chat function error", {
      requestId,
      durationMs: duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
