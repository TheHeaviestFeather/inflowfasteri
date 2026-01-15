/**
 * Response caching utilities for the chat edge function
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./logger.ts";
import { CACHE_TTL_HOURS } from "./constants.ts";

/**
 * SHA-256 hash function for prompt caching
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate cache key from system prompt + messages
 */
export async function generateCacheKey(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<string> {
  const payload = JSON.stringify({ systemPrompt, messages, model });
  return await sha256(payload);
}

/**
 * Check cache for existing response
 */
export async function getCachedResponse(
  serviceClient: SupabaseClient,
  promptHash: string,
  requestId: string
): Promise<string | null> {
  const { data: cachedData } = await serviceClient
    .from("response_cache")
    .select("response, id")
    .eq("prompt_hash", promptHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cachedData?.response) {
    log("info", "Cache hit", { requestId, promptHash: promptHash.slice(0, 12) });
    
    // Record cache hit asynchronously (fire and forget)
    serviceClient.rpc("record_cache_hit", { p_prompt_hash: promptHash }).then(() => {}, () => {});
    
    return cachedData.response;
  }

  return null;
}

/**
 * Store response in cache
 */
export async function cacheResponse(
  serviceClient: SupabaseClient,
  promptHash: string,
  response: string,
  model: string,
  promptVersion: string,
  tokensIn: number | null,
  tokensOut: number | null,
  requestId: string
): Promise<void> {
  if (response.length === 0) return;

  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    await serviceClient.from("response_cache").insert({
      prompt_hash: promptHash,
      response,
      model,
      prompt_version: promptVersion,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      expires_at: expiresAt,
    });
    log("info", "Response cached", {
      requestId,
      promptHash: promptHash.slice(0, 12),
      responseLength: response.length,
    });
  } catch (cacheError) {
    // Don't fail if caching fails (could be duplicate key on race condition)
    log("warn", "Failed to cache response", {
      requestId,
      error: cacheError instanceof Error ? cacheError.message : "Unknown",
    });
  }
}

/**
 * Create a readable stream from cached response (simulates SSE for consistency)
 */
export function streamFromCache(cachedResponse: string): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // Split response into chunks to simulate streaming
      const chunkSize = 50; // characters per chunk
      let offset = 0;

      const sendNextChunk = () => {
        if (offset >= cachedResponse.length) {
          // Send done signal
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const chunk = cachedResponse.slice(offset, offset + chunkSize);
        offset += chunkSize;

        const sseData = {
          choices: [
            {
              delta: { content: chunk },
              index: 0,
            },
          ],
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));

        // Small delay to simulate streaming
        setTimeout(sendNextChunk, 10);
      };

      sendNextChunk();
    },
  });
}
