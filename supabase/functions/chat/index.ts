import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constants
const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 50000;
const RATE_LIMIT_MAX_REQUESTS = 30; // per minute
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Fallback system prompt if database fetch fails
const FALLBACK_SYSTEM_PROMPT = `You are an instructional design consultant. Help users create effective learning solutions.`;

interface RequestLog {
  requestId: string;
  userId: string;
  startTime: number;
  messageCount: number;
  endpoint: string;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  console.log(JSON.stringify(logEntry));
}

serve(async (req) => {
  const requestId = generateRequestId();
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
      log("warn", "Invalid token shape", { requestId, tokenLength: tokenPart.length });
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create clients - one for user context, one for service operations
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
      log("warn", "Authentication failed", { requestId, error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("info", "Request started", { requestId, userId: user.id });

    // Rate limiting check using database function
    const { data: isAllowed, error: rateLimitError } = await serviceClient.rpc("check_rate_limit", {
      p_user_id: user.id,
      p_endpoint: "chat",
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (rateLimitError) {
      log("error", "Rate limit check failed", { requestId, error: rateLimitError.message });
      // Continue anyway - don't block users due to rate limit infrastructure issues
    } else if (!isAllowed) {
      log("warn", "Rate limit exceeded", { requestId, userId: user.id });
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      log("warn", "Invalid messages format", { requestId });
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
      log("warn", "Message count out of range", { requestId, count: body.messages.length });
      return new Response(
        JSON.stringify({ error: `Message count must be between 1 and ${MAX_MESSAGES}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each message
    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        log("warn", "Message missing role or content", { requestId });
        return new Response(
          JSON.stringify({ error: "Each message must have role and content" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (typeof msg.role !== "string" || !["user", "assistant", "system"].includes(msg.role)) {
        log("warn", "Invalid message role", { requestId, role: msg.role });
        return new Response(
          JSON.stringify({ error: "Invalid message role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (typeof msg.content !== "string" || msg.content.length > MAX_CONTENT_LENGTH) {
        log("warn", "Invalid message content", { requestId, length: msg.content?.length });
        return new Response(
          JSON.stringify({ error: `Message content must be string under ${MAX_CONTENT_LENGTH} characters` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch active system prompt from database
    let systemPrompt = FALLBACK_SYSTEM_PROMPT;
    const { data: promptData, error: promptError } = await serviceClient
      .from("system_prompts")
      .select("content")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (promptError) {
      log("warn", "Failed to fetch system prompt", { requestId, error: promptError.message });
    } else if (promptData?.content) {
      systemPrompt = promptData.content;
      log("info", "Using database system prompt", { requestId, promptLength: systemPrompt.length });
    } else {
      log("info", "No active system prompt found, using fallback", { requestId });
    }

    const messages = body.messages;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      log("error", "LOVABLE_API_KEY not configured", { requestId });
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    log("info", "Calling AI gateway", { requestId, messageCount: messages.length });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("error", "AI gateway error", { requestId, status: response.status, error: errorText });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duration = Date.now() - startTime;
    log("info", "Streaming response started", { requestId, durationMs: duration });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log("error", "Chat function error", {
      requestId,
      durationMs: duration,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
