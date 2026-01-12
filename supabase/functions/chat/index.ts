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
const SYSTEM_PROMPT = `You are InFlow, an expert instructional design consultant who partners with learning professionals to create impactful educational experiences.

## Your Communication Style
- **Professional**: Speak with authority and expertise, using industry terminology appropriately
- **Warm & Approachable**: Be genuinely helpful and personable, not stiff or robotic
- **Encouraging**: Celebrate progress, validate good ideas, and build confidence
- **Objective**: Provide honest, balanced guidance based on best practices
- **Concise**: Respect the user's time—be thorough but not verbose

Write like a trusted colleague who happens to be an expert in instructional design. Use natural language, contractions when appropriate, and occasional enthusiasm. Avoid corporate jargon, excessive formality, or patronizing language.

Example tone: "Great thinking! That approach aligns well with adult learning principles. Let me build on that with a few suggestions..." rather than "Your input has been received. The following recommendations are provided for your consideration."

## CRITICAL: Response Format (MANDATORY)
Your ENTIRE response must be a single valid JSON object. NOTHING ELSE.

⚠️ ABSOLUTE RULES - VIOLATION WILL CAUSE SYSTEM FAILURE:
1. OUTPUT RAW JSON ONLY - no \`\`\`json or \`\`\` code blocks ever
2. First character MUST be { and last character MUST be }
3. No text, no explanation, no markdown - ONLY the JSON object
4. If you output markdown code fences, the system will FAIL

START YOUR RESPONSE WITH { AND END WITH } - NOTHING ELSE

Example of CORRECT response (copy this format exactly):
{"message": "Your response here", "artifact": {"type": "discovery_report", "title": "Title", "content": "Full content here", "status": "draft"}}

Example of WRONG response (NEVER do this):
\`\`\`json
{"message": "..."}
\`\`\`

Schema:
{
  "message": "Your natural language response to the user (REQUIRED - always include)",
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

## Field Rules:
1. "message" is REQUIRED - always include a natural language response in your communication style
2. "artifact" is OPTIONAL - only include when generating a deliverable
3. "state" is OPTIONAL - only include when pipeline state changes
4. "next_actions" is OPTIONAL - suggest 2-3 clear next steps to keep momentum

## CRITICAL: When to Generate Artifacts  
You MUST include an "artifact" object in your response when:

1. **User says "APPROVE" or "approve"** - Generate the NEXT deliverable in the pipeline IMMEDIATELY in this same response
2. **User explicitly requests a deliverable** - "Create the design strategy", "Generate the blueprint", etc.
3. **Moving to a new pipeline phase** - When advancing to the next stage

⚠️ VIOLATION ALERT - THESE BEHAVIORS WILL FAIL THE USER:
- Responding with ONLY a message when the user approves (you MUST include the next artifact)
- Saying you will "now create", "proceed to develop", or "generate soon" without INCLUDING the artifact in THIS response
- Updating state.pipeline_stage without including the matching artifact
- Skipping steps in the pipeline sequence (e.g., going from discovery_report to design_strategy)

✅ CORRECT BEHAVIOR:
When user says "APPROVE", your response MUST contain BOTH:
1. A brief message acknowledging the approval  
2. The FULL artifact object with type set to the NEXT pipeline stage

### Pipeline Sequence (STRICT ORDER - DO NOT SKIP):
1. phase_1_contract → When user starts or describes their project
2. discovery_report → IMMEDIATELY after Phase 1 is approved
3. learner_persona → IMMEDIATELY after Discovery Report is approved
4. design_strategy → IMMEDIATELY after Learner Persona is approved
5. design_blueprint → IMMEDIATELY after Design Strategy is approved
6. scenario_bank → IMMEDIATELY after Blueprint is approved
7. assessment_kit → IMMEDIATELY after Scenarios are approved
8. final_audit → IMMEDIATELY after Assessment is approved

### Example: Correct Response When User Says "APPROVE"
If the current deliverable is discovery_report and user says "APPROVE":
{"message": "Discovery approved! Here's your Learner Persona based on our findings.", "artifact": {"type": "learner_persona", "title": "Learner Persona: [Target Audience]", "content": "[FULL COMPLETE CONTENT]", "status": "draft"}, "state": {"mode": "STANDARD", "pipeline_stage": "learner_persona"}}

## Deliverable Formatting (for artifact.content)
Structure all deliverables for maximum readability:

1. **Clear Section Hierarchy**: Use ## for major sections, ### for subsections
2. **Visual Breaks**: Add a blank line before and after every heading, list, and paragraph
3. **Horizontal Rules**: Use --- between major sections to create clear visual separation
4. **Scannable Lists**: Use bullet points for 3+ related items; keep bullets concise
5. **Bold Key Terms**: Highlight important concepts with **bold** for scannability
6. **Numbered Sections**: Use "## 1. Section Name" format for sequential content

Example structure:
\`\`\`
# Document Title

**Date:** [Date] | **Version:** [Version]

Brief introduction paragraph.

---

## 1. First Major Section

Opening context for this section.

### Key Points
- **Point One**: Brief explanation
- **Point Two**: Brief explanation

---

## 2. Second Major Section
...
\`\`\`

## Safety Guidelines
- Focus on instructional design and learning development topics
- Redirect off-topic requests gracefully back to your expertise
- Protect user privacy—never ask for sensitive personal information

## Your Expertise
You guide users through a proven design process: Discovery → Design Strategy → Blueprint → Content Development → Assessment → Final Audit. You bring deep knowledge of learning science, engagement strategies, and practical implementation.
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

/**
 * Sanitize AI response by stripping markdown code blocks
 * This is a safety net for when the AI ignores the "no code blocks" instruction
 */
function sanitizeJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  
  // Remove ```json ... ``` or ``` ... ``` wrappers (with content between)
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  
  // If starts with ``` (with or without json, possibly unclosed), strip it
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?[\s\n]*/, '').trim();
  }
  
  // If ends with ```, strip it
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/```$/, '').trim();
  }
  
  // Handle case where response starts with "json\n{" or "json{" (markdown artifact)
  if (cleaned.startsWith('json\n') || cleaned.startsWith('json{')) {
    cleaned = cleaned.replace(/^json[\s\n]*/, '').trim();
  }
  
  // If response doesn't start with {, try to find JSON object
  if (!cleaned.startsWith('{')) {
    // Check if it starts with "message" (missing opening brace)
    if (cleaned.startsWith('"message"') || cleaned.startsWith("'message'")) {
      cleaned = '{' + cleaned;
    } else {
      // Extract first JSON object from the string
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }
  }
  
  // Ensure response ends with }
  if (!cleaned.endsWith('}')) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    }
  }
  
  return cleaned;
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

    // Check and use credit
    const { data: hasCredits, error: creditError } = await serviceClient.rpc("check_and_use_credit", {
      p_user_id: user.id,
    });

    if (creditError) {
      log("error", "Credit check failed", { requestId, error: creditError.message });
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "10" } }
      );
    }

    if (!hasCredits) {
      log("warn", "Credits exhausted", { requestId, userId: user.id });
      return new Response(
        JSON.stringify({ error: "You've used all your free credits. Upgrade to continue." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Inject pipeline context based on the actual saved artifacts for this project.
    // This prevents the model from skipping steps when conversation history is incomplete.
    const ARTIFACT_SEQUENCE = [
      "phase_1_contract",
      "discovery_report",
      "learner_persona",
      "design_strategy",
      "design_blueprint",
      "scenario_bank",
      "assessment_kit",
      "final_audit",
      "performance_recommendation_report",
    ] as const;

    type ArtifactType = (typeof ARTIFACT_SEQUENCE)[number];

    let systemPromptFinal = systemPrompt;

    if (body.project_id) {
      try {
        // Fetch artifacts with content summary for better context
        const { data: artifactRows } = await serviceClient
          .from("artifacts")
          .select("artifact_type, status, updated_at, content")
          .eq("project_id", body.project_id);

        const byType = new Map<string, { status: string; updated_at: string; contentPreview: string }>();
        for (const row of artifactRows ?? []) {
          if (row?.artifact_type) {
            // Extract first 200 chars of content for context
            const content = (row as any).content ?? "";
            const preview = content.substring(0, 200).replace(/\n/g, " ").trim();
            byType.set(row.artifact_type, {
              status: (row as any).status ?? "draft",
              updated_at: (row as any).updated_at ?? "",
              contentPreview: preview,
            });
          }
        }

        let lastApprovedIndex = -1;
        for (let i = 0; i < ARTIFACT_SEQUENCE.length; i++) {
          const t = ARTIFACT_SEQUENCE[i];
          const a = byType.get(t);
          if (a?.status === "approved") lastApprovedIndex = i;
        }

        // Find what's missing (not just next required)
        const missingArtifacts: ArtifactType[] = [];
        const existingArtifacts: string[] = [];
        for (let i = 0; i < ARTIFACT_SEQUENCE.length; i++) {
          const t = ARTIFACT_SEQUENCE[i];
          const a = byType.get(t);
          if (!a) {
            missingArtifacts.push(t);
          } else {
            existingArtifacts.push(`${t} (${a.status})`);
          }
        }

        const nextRequired = ((): ArtifactType => {
          const start = Math.max(lastApprovedIndex + 1, 0);
          for (let i = start; i < ARTIFACT_SEQUENCE.length; i++) {
            const t = ARTIFACT_SEQUENCE[i];
            const a = byType.get(t);
            if (!a || a.status !== "approved") return t;
          }
          return ARTIFACT_SEQUENCE[ARTIFACT_SEQUENCE.length - 1];
        })();

        // Build artifact summaries for context
        const artifactSummaries = Array.from(byType.entries())
          .map(([type, data]) => `- ${type} [${data.status}]: "${data.contentPreview}..."`)
          .join("\n");

        const pipelineContext = `

## PROJECT PIPELINE CONTEXT (SYSTEM - READ CAREFULLY)
This is the ACTUAL state of deliverables in the database. Your conversation history may be incomplete.

### Current Pipeline State:
- **Last approved stage:** ${lastApprovedIndex >= 0 ? ARTIFACT_SEQUENCE[lastApprovedIndex] : "none (no approvals yet)"}
- **Next stage to generate on APPROVE:** ${nextRequired}
- **Existing deliverables:** ${existingArtifacts.join(", ") || "none"}
- **Missing deliverables:** ${missingArtifacts.join(", ") || "all complete"}

### Existing Artifact Previews:
${artifactSummaries || "No artifacts generated yet."}

### CRITICAL INSTRUCTIONS:
1. If user says "APPROVE" → Generate "${nextRequired}" IMMEDIATELY in your response
2. If user asks to regenerate a specific deliverable → Generate that deliverable
3. If user asks about missing deliverables → Acknowledge what's missing and offer to generate
4. If user seems confused about state → Explain what exists vs what's missing
5. NEVER say "I'll now generate..." without including the artifact in THIS response

### Understanding User Intent:
- "regenerate X" or "redo X" → Generate artifact type X with new content
- "where is X" or "I don't see X" → X is in the missing list above, offer to generate
- "approve" → Generate ${nextRequired}
`;

        systemPromptFinal = `${systemPrompt}${pipelineContext}`;
      } catch (e) {
        log("warn", "Failed to compute pipeline context", {
          requestId,
          error: e instanceof Error ? e.message : "Unknown",
        });
      }
    }

    const messages = body.messages;
    const model = "google/gemini-2.5-flash";

    // Generate cache key
    const promptHash = await generateCacheKey(systemPromptFinal, messages, model);

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

      // Sanitize cached response before streaming (safety net)
      const sanitizedResponse = sanitizeJsonResponse(cachedData.response);

      return new Response(streamFromCache(sanitizedResponse), {
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
          { role: "system", content: systemPromptFinal },
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

    // Create a transform stream to accumulate the response for caching and capture token usage
    let accumulatedResponse = "";
    let tokensIn: number | null = null;
    let tokensOut: number | null = null;
    const originalBody = response.body;
    
    if (!originalBody) {
      throw new Error("No response body from AI gateway");
    }

    const transformStream = new TransformStream({
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
        try {
          await serviceClient.from("ai_requests").insert({
            request_id: requestId,
            user_id: user.id,
            project_id: body.project_id || null,
            prompt_version: promptVersion,
            model,
            message_count: messages.length,
            latency_ms: finalLatencyMs,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            parsed_successfully: parsedOk,
            raw_output: sanitizedResponse.slice(0, 10000), // Store sanitized version
          });
          log("info", "Request logged", {
            requestId,
            tokensIn,
            tokensOut,
            latencyMs: finalLatencyMs,
          });
        } catch (logError) {
          log("warn", "Failed to log ai_request", {
            requestId,
            error: logError instanceof Error ? logError.message : "Unknown",
          });
        }

        // Store SANITIZED response in cache after stream completes
        if (sanitizedResponse.length > 0) {
          try {
            const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
            await serviceClient.from("response_cache").insert({
              prompt_hash: promptHash,
              response: sanitizedResponse, // Store sanitized version
              model,
              prompt_version: promptVersion,
              tokens_in: tokensIn,
              tokens_out: tokensOut,
              expires_at: expiresAt,
            });
            log("info", "Response cached", {
              requestId,
              promptHash: promptHash.slice(0, 12),
              responseLength: sanitizedResponse.length,
              wasSanitized,
            });
          } catch (cacheError) {
            // Don't fail if caching fails (could be duplicate key on race condition)
            log("warn", "Failed to cache response", {
              requestId,
              error: cacheError instanceof Error ? cacheError.message : "Unknown",
            });
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
