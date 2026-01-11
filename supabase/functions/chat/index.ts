import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Get allowed origins from environment or use default
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) return "";

  // Allow any Lovable preview origin
  if (requestOrigin.endsWith(".lovableproject.com")) {
    return requestOrigin;
  }

  const allowedOrigins = [
    "https://lovable.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    Deno.env.get("ALLOWED_ORIGIN"),
  ].filter(Boolean) as string[];

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Default to first known origin (or empty) to avoid reflecting arbitrary origins
  return allowedOrigins[0] || "";
};

const getCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(req.headers.get("Origin")),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Credentials": "true",
});

// Constants
const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 50000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const CURRENT_PROMPT_VERSION = "v2.0";
const CACHE_TTL_HOURS = 24; // Cache responses for 24 hours

// JSON Schema-enforced system prompt
const SYSTEM_PROMPT = `You are InFlow, an AI instructional design consultant. You help users create effective learning solutions through a structured design process.

## CRITICAL: Response Format
You MUST respond with valid JSON matching this exact schema. NO TEXT OUTSIDE THE JSON.

{
  "message": "Your natural language response to the user (REQUIRED)",
  "artifact": {
    "type": "one of the valid types below",
    "title": "Title of the deliverable",
    "content": "The full markdown content of the deliverable",
    "status": "draft"
  },
  "state": {
    "mode": "STANDARD or QUICK",
    "pipeline_stage": "current stage name"
  },
  "next_actions": ["suggested next step 1", "suggested next step 2"]
}

## Valid artifact types (use exactly as shown):
- phase_1_contract
- discovery_report
- learner_persona
- design_strategy
- design_blueprint
- scenario_bank
- assessment_kit
- final_audit
- performance_recommendation_report

## Rules:
1. "message" is REQUIRED - always include a natural language response
2. "artifact" is OPTIONAL - only include when generating a deliverable
3. "state" is OPTIONAL - only include when pipeline state changes
4. "next_actions" is OPTIONAL - include to guide the user
5. Do NOT include any text outside the JSON object
6. Do NOT wrap the JSON in markdown code blocks
7. The "content" field in artifact should contain rich markdown

## Safety Guidelines
- Focus only on instructional design and learning development topics
- Do not generate content that could be harmful, discriminatory, or inappropriate
- If asked about topics outside instructional design, politely redirect to your purpose
- Protect user privacy - do not ask for or store sensitive personal information

## Your Expertise
You guide users through: Discovery → Design Strategy → Blueprint → Content Development → Assessment → Final Audit
`;

const FALLBACK_SYSTEM_PROMPT = SYSTEM_PROMPT;

// PII Redaction for logging
function redactPII(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, '[EMAIL]')
    .replace(/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const safeContext = context ? Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k, typeof v === 'string' ? redactPII(v) : v])
  ) : {};
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeContext,
  };
  console.log(JSON.stringify(logEntry));
}

// SHA-256 hash function for prompt caching
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate cache key from system prompt + messages
async function generateCacheKey(systemPrompt: string, messages: Array<{ role: string; content: string }>, model: string): Promise<string> {
  const payload = JSON.stringify({ systemPrompt, messages, model });
  return await sha256(payload);
}

// Create a readable stream from cached response (simulates SSE for consistency)
function streamFromCache(cachedResponse: string): ReadableStream {
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
          choices: [{
            delta: { content: chunk },
            index: 0,
          }]
        };
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
        
        // Small delay to simulate streaming
        setTimeout(sendNextChunk, 10);
      };
      
      sendNextChunk();
    }
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const requestId = req.headers.get("X-Request-ID") || generateRequestId();
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      log("warn", "Missing authorization header", { requestId });
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenPart = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isValidJwtShape = tokenPart.split(".").length === 3;
    
    if (!isValidJwtShape) {
      log("warn", "Invalid token shape", { requestId });
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("info", "Request started", { requestId, userId: user.id });

    // Rate limiting
    const { data: isAllowed, error: rateLimitError } = await serviceClient.rpc("check_rate_limit", {
      p_user_id: user.id,
      p_endpoint: "chat",
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (rateLimitError) {
      log("error", "Rate limit check failed", { requestId, error: rateLimitError.message });
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "10" } }
      );
    }
    
    if (!isAllowed) {
      log("warn", "Rate limit exceeded", { requestId });
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();

    // Validate project ownership
    if (body.project_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof body.project_id !== "string" || !uuidRegex.test(body.project_id)) {
        log("warn", "Invalid project_id format", { requestId });
        return new Response(
          JSON.stringify({ error: "Invalid project ID format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: projectData, error: projectError } = await userClient
        .from("projects")
        .select("id")
        .eq("id", body.project_id)
        .maybeSingle();

      if (projectError || !projectData) {
        log("warn", "Project not found or access denied", { requestId });
        return new Response(
          JSON.stringify({ error: "Project not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_MESSAGES} messages allowed` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return new Response(
          JSON.stringify({ error: "Each message must have role and content" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!["user", "assistant", "system"].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: "Invalid message role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (typeof msg.content !== "string" || msg.content.length > MAX_CONTENT_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Message content must be under ${MAX_CONTENT_LENGTH} characters` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get system prompt (try database first, fall back to default)
    let systemPrompt = FALLBACK_SYSTEM_PROMPT;
    let promptVersion = CURRENT_PROMPT_VERSION;
    
    const { data: promptData } = await serviceClient
      .from("system_prompts")
      .select("content, version")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (promptData?.content) {
      systemPrompt = promptData.content;
      promptVersion = promptData.version || CURRENT_PROMPT_VERSION;
    }

    const messages = body.messages;
    const model = "google/gemini-2.5-flash";

    // Generate cache key
    const promptHash = await generateCacheKey(systemPrompt, messages, model);
    
    // Check cache first
    const { data: cachedData } = await serviceClient
      .from("response_cache")
      .select("response, id")
      .eq("prompt_hash", promptHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cachedData?.response) {
      log("info", "Cache hit", { requestId, promptHash: promptHash.slice(0, 12) });
      
      // Record cache hit asynchronously (fire and forget)
      serviceClient.rpc("record_cache_hit", { p_prompt_hash: promptHash }).then(() => {}).then(() => {}, () => {});
      
      const latencyMs = Date.now() - startTime;
      
      return new Response(streamFromCache(cachedData.response), {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "text/event-stream",
          "X-Request-ID": requestId,
          "X-Prompt-Version": promptVersion,
          "X-Cache-Status": "HIT",
        },
      });
    }

    log("info", "Cache miss, calling AI gateway", { requestId, messageCount: messages.length, model, promptVersion });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      log("error", "LOVABLE_API_KEY not configured", { requestId });
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("error", "AI gateway error", { requestId, status: response.status });

      // Log the failed request for debugging
      try {
        await serviceClient.from("ai_requests").insert({
          request_id: requestId,
          user_id: user.id,
          project_id: body.project_id || null,
          prompt_version: promptVersion,
          model,
          message_count: messages.length,
          latency_ms: Date.now() - startTime,
          parsed_successfully: false,
          parse_errors: [`HTTP ${response.status}: ${errorText.slice(0, 200)}`],
        });
      } catch {
        // Don't fail if logging fails
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const latencyMs = Date.now() - startTime;
    log("info", "Streaming response started", { requestId, latencyMs });

    // Create a transform stream to accumulate the response for caching
    let accumulatedResponse = "";
    const originalBody = response.body;
    
    if (!originalBody) {
      throw new Error("No response body from AI gateway");
    }

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // Pass through the chunk
        controller.enqueue(chunk);
        
        // Accumulate for caching
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const jsonStr = line.slice(6);
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedResponse += content;
              }
            } catch {
              // Ignore parse errors for individual chunks
            }
          }
        }
      },
      async flush() {
        // Store in cache after stream completes
        if (accumulatedResponse.length > 0) {
          try {
            const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
            await serviceClient.from("response_cache").insert({
              prompt_hash: promptHash,
              response: accumulatedResponse,
              model,
              prompt_version: promptVersion,
              expires_at: expiresAt,
            });
            log("info", "Response cached", { requestId, promptHash: promptHash.slice(0, 12), responseLength: accumulatedResponse.length });
          } catch (cacheError) {
            // Don't fail if caching fails (could be duplicate key on race condition)
            log("warn", "Failed to cache response", { requestId, error: cacheError instanceof Error ? cacheError.message : "Unknown" });
          }
        }
      }
    });

    const cachedStream = originalBody.pipeThrough(transformStream);

    return new Response(cachedStream, {
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
