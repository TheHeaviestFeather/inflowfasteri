/**
 * AI Gateway integration for streaming responses
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log, redactPII } from "./logger.ts";
import { sanitizeJsonResponse } from "./sanitize.ts";
import { cacheResponse } from "./cache.ts";

/**
 * Timeout for AI gateway requests (25 seconds)
 * Deno edge functions have a 30s limit, so we need to timeout before that
 */
const AI_GATEWAY_TIMEOUT_MS = 25000;

export interface StreamOptions {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  promptVersion: string;
  promptHash: string;
  userId: string;
  projectId: string | null;
  requestId: string;
  startTime: number;
  serviceClient: SupabaseClient;
}

/**
 * Call AI gateway and return streaming response
 */
export async function streamAIResponse(options: StreamOptions): Promise<Response | null> {
  const {
    model,
    systemPrompt,
    messages,
    promptVersion,
    promptHash,
    userId,
    projectId,
    requestId,
    startTime,
    serviceClient,
  } = options;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    log("error", "LOVABLE_API_KEY not configured", { requestId });
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  log("info", "Calling AI gateway", { requestId, messageCount: messages.length, model, promptVersion });

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, AI_GATEWAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal: abortController.signal,
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      log("error", "AI gateway request timed out", { requestId, timeoutMs: AI_GATEWAY_TIMEOUT_MS });
      await logAIRequest(serviceClient, {
        requestId,
        userId,
        projectId,
        promptVersion,
        model,
        messageCount: messages.length,
        latencyMs: Date.now() - startTime,
        parsedSuccessfully: false,
        parseErrors: [`Request timed out after ${AI_GATEWAY_TIMEOUT_MS}ms`],
      });
    } else {
      log("error", "AI gateway fetch error", { requestId, error: fetchError instanceof Error ? fetchError.message : "Unknown" });
    }
    return null;
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    log("error", "AI gateway error", { requestId, status: response.status });

    // Log the failed request for debugging
    await logAIRequest(serviceClient, {
      requestId,
      userId,
      projectId,
      promptVersion,
      model,
      messageCount: messages.length,
      latencyMs: Date.now() - startTime,
      parsedSuccessfully: false,
      parseErrors: [`HTTP ${response.status}: ${errorText.slice(0, 200)}`],
    });

    return null;
  }

  const latencyMs = Date.now() - startTime;
  log("info", "Streaming response started", { requestId, latencyMs });

  const originalBody = response.body;
  if (!originalBody) {
    throw new Error("No response body from AI gateway");
  }

  // Create a transform stream to accumulate the response for caching
  const transformStream = createAccumulatingTransform({
    requestId,
    userId,
    projectId,
    promptVersion,
    promptHash,
    model,
    messageCount: messages.length,
    startTime,
    serviceClient,
  });

  return new Response(originalBody.pipeThrough(transformStream), {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

interface TransformOptions {
  requestId: string;
  userId: string;
  projectId: string | null;
  promptVersion: string;
  promptHash: string;
  model: string;
  messageCount: number;
  startTime: number;
  serviceClient: SupabaseClient;
}

/**
 * Create a transform stream that accumulates response for caching
 */
function createAccumulatingTransform(options: TransformOptions): TransformStream<Uint8Array, Uint8Array> {
  const {
    requestId,
    userId,
    projectId,
    promptVersion,
    promptHash,
    model,
    messageCount,
    startTime,
    serviceClient,
  } = options;

  let accumulatedResponse = "";
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  return new TransformStream({
    transform(chunk, controller) {
      // Pass through the chunk
      controller.enqueue(chunk);

      // Accumulate for caching and parse token usage
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const jsonStr = line.slice(6);
            const parsed = JSON.parse(jsonStr);

            // Capture content for caching
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulatedResponse += content;
            }

            // Capture token usage (typically in the final chunk)
            if (parsed.usage) {
              tokensIn = parsed.usage.prompt_tokens ?? null;
              tokensOut = parsed.usage.completion_tokens ?? null;
            }
          } catch {
            // Ignore parse errors for individual chunks
          }
        }
      }
    },
    async flush() {
      const finalLatencyMs = Date.now() - startTime;

      // Sanitize the accumulated response (strip markdown code blocks)
      const sanitizedResponse = sanitizeJsonResponse(accumulatedResponse);
      const wasSanitized = sanitizedResponse !== accumulatedResponse.trim();

      // Parse response to check validity and extract artifact info
      let parsedOk = false;
      let parsedArtifactType: string | null = null;
      let parsedPipelineStage: string | null = null;
      const hasArtifactKey = /"artifact"\s*:/.test(sanitizedResponse);
      const hasStateKey = /"state"\s*:/.test(sanitizedResponse);

      try {
        const parsed = JSON.parse(sanitizedResponse);
        parsedOk = typeof parsed === "object" && parsed !== null;
        parsedArtifactType = parsed?.artifact?.type ?? null;
        parsedPipelineStage = parsed?.state?.pipeline_stage ?? null;
      } catch {
        // Not valid JSON — will be logged below
      }

      // DEBUG: summarize what the model actually returned (redacted + truncated)
      try {
        const preview = redactPII(sanitizedResponse.slice(0, 800));
        log("info", "AI output summary", {
          requestId,
          outputChars: sanitizedResponse.length,
          wasSanitized,
          preview,
          hasArtifactKey,
          hasStateKey,
          parsedOk,
          parsedArtifactType,
          parsedPipelineStage,
        });
      } catch {
        // Never fail request due to debug logging
      }

      // Log the successful request with token counts
      await logAIRequest(serviceClient, {
        requestId,
        userId,
        projectId,
        promptVersion,
        model,
        messageCount,
        latencyMs: finalLatencyMs,
        tokensIn,
        tokensOut,
        parsedSuccessfully: parsedOk,
        rawOutput: sanitizedResponse.slice(0, 10000),
      });

      // Store sanitized response in cache
      await cacheResponse(
        serviceClient,
        promptHash,
        sanitizedResponse,
        model,
        promptVersion,
        tokensIn,
        tokensOut,
        requestId
      );
    },
  });
}

interface AIRequestLog {
  requestId: string;
  userId: string;
  projectId: string | null;
  promptVersion: string;
  model: string;
  messageCount: number;
  latencyMs: number;
  tokensIn?: number | null;
  tokensOut?: number | null;
  parsedSuccessfully: boolean;
  parseErrors?: string[];
  rawOutput?: string;
}

/**
 * Log AI request to database
 */
async function logAIRequest(serviceClient: SupabaseClient, data: AIRequestLog): Promise<void> {
  try {
    await serviceClient.from("ai_requests").insert({
      request_id: data.requestId,
      user_id: data.userId,
      project_id: data.projectId || null,
      prompt_version: data.promptVersion,
      model: data.model,
      message_count: data.messageCount,
      latency_ms: data.latencyMs,
      tokens_in: data.tokensIn ?? null,
      tokens_out: data.tokensOut ?? null,
      parsed_successfully: data.parsedSuccessfully,
      parse_errors: data.parseErrors,
      raw_output: data.rawOutput,
    });
    log("info", "Request logged", {
      requestId: data.requestId,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      latencyMs: data.latencyMs,
    });
  } catch (logError) {
    log("warn", "Failed to log ai_request", {
      requestId: data.requestId,
      error: logError instanceof Error ? logError.message : "Unknown",
    });
  }
}
