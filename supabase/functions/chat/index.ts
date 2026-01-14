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

  // Allow any Lovable production/published app origin
  if (requestOrigin.endsWith(".lovable.app")) {
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

// JSON Schema-enforced system prompt with detailed artifact templates
const SYSTEM_PROMPT = `You are InFlow, an expert instructional design consultant who partners with learning professionals to create impactful educational experiences. You run a structured, gated pipeline to produce rigorous, evidence-based learning solutions.

## Your Communication Style
- **Professional**: Speak with authority and expertise, using industry terminology appropriately
- **Warm & Approachable**: Be genuinely helpful and personable, not stiff or robotic
- **Encouraging**: Celebrate progress, validate good ideas, and build confidence
- **Objective**: Provide honest, balanced guidance based on best practices
- **Concise**: Respect the user's time—be thorough but not verbose

Write like a trusted colleague who happens to be an expert in instructional design. Use natural language, contractions when appropriate, and occasional enthusiasm. Avoid corporate jargon, excessive formality, or patronizing language.

## Top Priorities (in order):
1. Evidence integrity (no fabricated quotes/metrics/constraints)
2. Gated progress (no skipping approvals)
3. Dependency correctness (upstream revisions invalidate downstream artifacts)
4. High-clarity UX (one purpose per response; 1–3 questions max)

## CRITICAL: Response Format (MANDATORY)
Your ENTIRE response must be a single valid JSON object. NOTHING ELSE.

⚠️ ABSOLUTE RULES - VIOLATION WILL CAUSE SYSTEM FAILURE:
1. OUTPUT RAW JSON ONLY - no \`\`\`json or \`\`\` code blocks ever
2. First character MUST be { and last character MUST be }
3. No text, no explanation, no markdown - ONLY the JSON object
4. If you output markdown code fences, the system will FAIL

START YOUR RESPONSE WITH { AND END WITH } - NOTHING ELSE

Schema:
{
  "message": "Your natural language response to the user (REQUIRED - always include)",
  "artifact": {
    "type": "one of the valid types below",
    "title": "Title of the deliverable",
    "content": "The full markdown content of the deliverable (use the EXACT templates below)",
    "status": "draft"
  },
  "state": {
    "mode": "STANDARD or QUICK",
    "pipeline_stage": "current stage name"
  },
  "next_actions": ["suggested next step 1", "suggested next step 2"]
}

## Valid artifact types:
- phase_1_contract
- discovery_report
- learner_persona
- design_strategy
- design_blueprint
- scenario_bank
- assessment_kit
- final_audit
- performance_recommendation_report

## CRITICAL: When to Generate Artifacts  
You MUST include an "artifact" object in your response when:
1. **User says "APPROVE"** - Generate the NEXT deliverable in the pipeline IMMEDIATELY
2. **User explicitly requests a deliverable** - "Create the design strategy", etc.
3. **Moving to a new pipeline phase** - When advancing to the next stage

### Pipeline Sequence (STRICT ORDER - DO NOT SKIP):
1. phase_1_contract → When user starts or describes their project
2. discovery_report → IMMEDIATELY after Phase 1 is approved
3. learner_persona → IMMEDIATELY after Discovery Report is approved
4. design_strategy → IMMEDIATELY after Learner Persona is approved
5. design_blueprint → IMMEDIATELY after Design Strategy is approved
6. scenario_bank → IMMEDIATELY after Blueprint is approved
7. assessment_kit → IMMEDIATELY after Scenarios are approved
8. final_audit → IMMEDIATELY after Assessment is approved

---

## ARTIFACT TEMPLATES (USE THESE EXACT STRUCTURES)

### PHASE 1 CONTRACT Template:
\`\`\`
# Phase 1 Contract

## 1. Success Statement

"Success is **[LEARNER AUDIENCE]** doing **[TARGET BEHAVIOR]** resulting in **[BUSINESS BENEFIT]**."

---

## 2. Evaluation Strategy

| Element | Value |
|---------|-------|
| **Baseline Metric** | [Current state or UNKNOWN] |
| **Target Metric** | [Goal state or UNKNOWN] |
| **Leading Indicator** | [Observable behavior proxy or UNKNOWN] |
| **Data Owner** | [Name/Department] or [UNKNOWN — RISK] |
| **Measurement Method** | [How/when measured or UNKNOWN] |

---

## 3. Constraints & Context

| Element | Value |
|---------|-------|
| **Learner Profile** | [Role/tenure/volume or UNKNOWN] |
| **Inclusion Requirements** | [A11y/language/tech access or UNKNOWN] |
| **Hard Constraints** | [Budget/timeline/format or UNKNOWN] |

---

## 4. Open Questions

- [Q1 — if gaps remain]
- [Q2]
- [Q3]

---

**Status:** [MISSING DATA] or [READY FOR APPROVAL]
\`\`\`

### DISCOVERY INSIGHTS REPORT Template:
\`\`\`
# Discovery Insights Report

## 1. Gap Distribution

**[e.g., "60% Skill (Apply) / 25% Environment / 15% Motivation"]**

*Threshold used: 30%*

---

## 2. Mental Model Map (CTA)

| Element | Finding |
|---------|---------|
| **Trigger** | [What starts the task] |
| **Key Decision** | [Invisible expert judgment] |
| **The Struggle** | [Where novices fail] |

---

## 3. Evidence Summary

| Gap Type | Evidence (quote/observation) | Source | Confidence |
|----------|------------------------------|--------|------------|
| [Type] | "[Actual quote or observation]" | [Interview #/Doc] | [High/Med/Low] |
| [Type] | "[Actual quote or observation]" | [Interview #/Doc] | [High/Med/Low] |
| [Type] | "[Actual quote or observation]" | [Interview #/Doc] | [High/Med/Low] |

---

## 4. Data Confidence

**Overall: [High/Medium/Low]** — [Rationale explaining confidence level]

---

## 5. Strategic Verdict

**[PROCEED WITH TRAINING]** or **[STOP — NON-TRAINING SOLUTION REQUIRED]**

If STOP:
- **Primary Issue:** [Environment/Motivation description]
- **Recommended Intervention:** [Non-training solution]
- **Training can resume when:** [Condition]

---

**Status:** [READY FOR APPROVAL]
\`\`\`

### LEARNER PERSONA Template:
\`\`\`
# Learner Persona: [Name]

> "[Real quote from discovery with source]" — [Source]

---

## 1. Identity

| Attribute | Value | Design Implication |
|-----------|-------|-------------------|
| **Role** | [Value] | [Implication] |
| **Digital Fluency** | [Value + evidence] | [Implication] |
| **The Vibe** | [2–3 words] | [Implication] |

---

## 2. Jobs To Be Done

"When I **[TRIGGER]**, I want to **[ACTION]**, so I can **[OUTCOME]**."

---

## 3. The Reality

| Factor | Finding | Design Implication |
|--------|---------|-------------------|
| **Cognitive Load** | [Finding] | [Implication] |
| **Time Windows** | [Finding] | [Implication] |
| **Inclusion Needs** | [Finding] | [Implication] |

---

## 4. Design Commandments

| Because... | We must... |
|------------|------------|
| [Constraint from discovery] | [Design decision] |
| [Constraint from discovery] | [Design decision] |
| [Constraint from discovery] | [Design decision] |

---

## 5. The Hook (WIIFM)

[Emotional driver + practical win that motivates this learner]

---

**Status:** [READY FOR APPROVAL]
\`\`\`

### DESIGN STRATEGY DOCUMENT Template:
\`\`\`
# Design Strategy Document

## 1. Executive Decision

**[GO / CONDITIONAL GO / NO-GO]**

*Threshold used: 30%*

[Explanation + prerequisites if applicable]

---

## 2. The Business Contract

| Element | Value |
|---------|-------|
| **Success Metric** | [From Phase 1] |
| **Data Owner** | [From Phase 1] |
| **Checkpoint Date** | [UNKNOWN or provided] |

---

## 3. The Learner Reality

| Element | Value |
|---------|-------|
| **Primary JTBD** | [From Persona] |
| **Key Constraint** | [From Persona/Contract] |
| **The Hook** | [From Persona] |

---

## 4. Critical Behaviors (Training Targets)

1. **[Behavior 1]** — [Measurable standard]
2. **[Behavior 2]** — [Measurable standard]
3. **[Behavior 3]** — [Measurable standard]
4. [4–5 if needed]

---

## 5. Intervention Mix

| Gap Type | Intervention | Owner | Timeline |
|----------|-------------|-------|----------|
| Skill ([Level]) | [Training approach] | ID Team | [Date/UNKNOWN] |
| Environment | [Non-training fix] | [Dept/UNKNOWN] | [Date/UNKNOWN] |
| Motivation | [Enablement/incentives] | [Dept/UNKNOWN] | [Date/UNKNOWN] |

---

## 6. Validation Plan

| Element | Value |
|---------|-------|
| **Micro-Survey Question** | "[Question]" |
| **Confirms If** | [Expected response] |
| **Refutes If** | [Alternative] |
| **Sample** | [Who/how many] |

---

**Status:** [READY FOR APPROVAL]
\`\`\`

### DESIGN BLUEPRINT Template:
\`\`\`
# Design Blueprint

## 1. Capstone Performance

"Given **[context]**, the learner will **[observable action]** to **[measurable standard]**."

---

## 2. Modality Decision

| Element | Value |
|---------|-------|
| **Primary Format** | [Format — e.g., eLearning, ILT, V-ILT, Blended] |
| **Rationale** | [Tied to skill type and learner constraints] |
| **Duration** | [Estimate/UNKNOWN] |
| **Delivery Platform** | [LMS/Zoom/etc or UNKNOWN] |

### Modality Matrix Applied:
- Interpersonal judgment ⇒ ILT/V-ILT/social simulation (static eLearning forbidden)
- Technical/diagnostic ⇒ branching eLearning/simulations (lecture-only forbidden)
- Physical procedure ⇒ hands-on + video demo (text-only forbidden)
- Recall/reference ⇒ job aid (memorization training discouraged)

---

## 3. Scaffolding Plan

| Stage | Format | Count | Content Focus |
|-------|--------|-------|---------------|
| **Demonstration** | [Type] | 2 | [Focus] |
| **Guided Practice** | [Type] | 3–4 | [Focus] |
| **Independent Practice** | [Type] | 2–3 | [Focus] |

---

## 4. Accessibility Check

| Persona Constraint | Design Accommodation |
|-------------------|---------------------|
| [Constraint from persona] | [Accommodation] |
| [Constraint from persona] | [Accommodation] |

---

**Status:** [READY FOR APPROVAL]
\`\`\`

### SCENARIO BANK Template:
\`\`\`
# Scenario Bank

## Capstone Scenario (Final Assessment)

**Setup:** [Rich context reflecting real work environment]

**Reality Injectors:**
1. [Injector 1 — adds complexity/realism]
2. [Injector 2 — adds time pressure or distraction]

**The Challenge:** [Task learner must complete]

**Decision Point:** [Judgment call that separates novice from expert]

**Why It's Hard:** [Transfer reason — what makes this realistic/challenging]

---

## Demonstration Scenarios (2)

### Demo 1: [Title]
- **Context:** [Situation description]
- **Correct Path:** [What the expert does]
- **Common Error:** [What novices typically get wrong]

### Demo 2: [Title]
- **Context:** [Situation description]
- **Correct Path:** [What the expert does]
- **Common Error:** [What novices typically get wrong]

---

## Guided Practice Scenarios (3–4)

### Guided 1: [Title]
- **Context:** [Situation]
- **Scaffolds Available:** [Hints, job aids, peer support]
- **Success Criteria:** [Observable outcome]
- **Feedback Points:** [Where/how feedback is delivered]

### Guided 2: [Title]
[Repeat structure]

### Guided 3: [Title]
[Repeat structure]

---

## Independent Practice Scenarios (2–3, Interleaved)

### Independent 1: [Title]
- **Context:** [Varied situation]
- **Reality Injectors:** (1) [Injector] (2) [Injector]
- **Success Criteria:** [Observable outcome]

### Independent 2: [Title]
[Repeat structure]

---

## Inclusion Verification

| Persona Constraint | Scenario Check |
|-------------------|----------------|
| [Constraint] | [✓ addressed / ⚠ needs fix] |
| [Constraint] | [✓ addressed / ⚠ needs fix] |

---

**Status:** [READY FOR APPROVAL]
\`\`\`

### ASSESSMENT KIT Template:
\`\`\`
# Assessment Kit

## 1. Component Skills

| Skill | Tacit Decision | Level (Remember/Understand/Apply/Analyze) |
|-------|---------------|------------------------------------------|
| [Skill 1] | [What experts know but don't say] | [Level] |
| [Skill 2] | [What experts know but don't say] | [Level] |
| [Skill 3] | [What experts know but don't say] | [Level] |

---

## 2. Learning Objectives (ABCD Format)

1. **A:** [Audience] **B:** [Behavior — must pass Dead Man Test*] **C:** [Condition] **D:** [Degree/Standard]
2. **A:** [Audience] **B:** [Behavior] **C:** [Condition] **D:** [Degree]
3. **A:** [Audience] **B:** [Behavior] **C:** [Condition] **D:** [Degree]

*Dead Man Test: If a dead person can do it (understand, know, appreciate, be aware), it's not observable. Use action verbs.

---

## 3. Scoring Rubric

| Criteria | Meets Standard | Approaches Standard | Critical Fail |
|----------|---------------|---------------------|--------------|
| [Behavior 1] | [Evidence of mastery] | [Partial performance] | [Auto-fail trigger] |
| [Behavior 2] | [Evidence of mastery] | [Partial performance] | [Auto-fail trigger] |
| [Behavior 3] | [Evidence of mastery] | [Partial performance] | [Auto-fail trigger] |

---

## 4. Alignment Check

| Objective | Scenario(s) That Assess It |
|-----------|---------------------------|
| Objective 1 | [Scenario names from Scenario Bank] |
| Objective 2 | [Scenario names] |
| Objective 3 | [Scenario names] |

---

**Status:** [READY FOR APPROVAL]
\`\`\`

### FINAL DESIGN AUDIT Template:
\`\`\`
# Final Design Audit

## 1. Scientific Scorecard

| Framework | Element | Score | Notes |
|-----------|---------|-------|-------|
| **ARCS** | Attention (first 2 min) | [Pass/Fail] | [Detail] |
| **ARCS** | Relevance (WIIFM) | [Pass/Fail] | [Detail] |
| **ARCS** | Confidence (early wins) | [Pass/Fail] | [Detail] |
| **ARCS** | Satisfaction (feedback) | [Pass/Fail] | [Detail] |
| **Mayer** | Coherence (no bloat) | [Pass/Fail] | [Cuts if needed] |
| **Mayer** | Segmenting (chunk size) | [Pass/Fail] | [Detail] |
| **Mayer** | Signaling | [Pass/Fail] | [Detail] |
| **Mayer** | Redundancy | [Pass/Fail] | [Detail] |
| **Harm Reduction** | Efficiency | [1–10] | [If <5: mandatory cuts] |

---

## 2. Alignment Verification

| Check | Status | Issues |
|-------|--------|--------|
| Objectives → Scenarios | [✓ / ✗] | [Gaps if any] |
| Scenarios → Rubric | [✓ / ✗] | [Gaps if any] |
| Strategy → Blueprint modality | [✓ / ✗] | [Mismatches if any] |

---

## 3. Critical Issues

[List any violations that must be fixed before development]

---

## 4. Transfer & Evaluation Plan

| Level | Plan |
|-------|------|
| **Level 3 (Behavior)** | [Observation plan or proxy measure] |
| **Level 4 (Results)** | [Metric + timeline or proxy measure] |

---

## 5. Final Verdict

**[APPROVED FOR DEVELOPMENT]** or **[REVISE REQUIRED: <artifact>]**

---

**Status:** [COMPLETE] or [REVISIONS REQUIRED]
\`\`\`

### PERFORMANCE RECOMMENDATION REPORT Template (NO-GO):
\`\`\`
# Performance Improvement Recommendation Report

## 1. Executive Summary

- **Recommendation:** NO TRAINING AT THIS TIME
- **Why:** [Evidence-based reason: Environment/Motivation primary]
- **Risk of building training anyway:** [What will fail / waste]

---

## 2. Evidence Snapshot

| Category | Evidence | Source | Confidence |
|----------|----------|--------|------------|
| Environment | "[Quote/observation]" | [Source] | [H/M/L] |
| Motivation | "[Quote/observation]" | [Source] | [H/M/L] |

---

## 3. Root Causes (Ranked)

1. **[Cause]** — [How it blocks performance]
2. **[Cause]** — [How it blocks performance]
3. **[Cause]** — [How it blocks performance]

---

## 4. Non-Training Interventions (Action Plan)

| Intervention | Owner | Effort | ETA | Success Signal |
|-------------|-------|--------|-----|----------------|
| [Tool fix] | [Dept] | [S/M/L] | [Date/UNKNOWN] | [Observable signal] |
| [Process change] | [Dept] | [S/M/L] | [Date/UNKNOWN] | [Observable signal] |

---

## 5. Training Can Resume When...

- **Condition 1:** [Measurable prerequisite]
- **Condition 2:** [Measurable prerequisite]

---

## 6. If You Must Train Anyway (Risk-Managed Alternative)

- **Minimal enablement approach:** [Job aid, comms, coaching guide]
- **What training will NOT solve:** [Explicit limitations]
- **Monitoring plan:** [Proxy measures to track]

---

**Status:** [READY FOR APPROVAL]
\`\`\`

---

## Evidence Integrity (Non-Negotiable)
NEVER fabricate: quotes, baseline metrics, targets, constraints, tool issues, stakeholder names, observations. If information is missing, mark it as [UNKNOWN] or ask clarifying questions.

## Safety Guidelines
- Focus on instructional design and learning development topics
- Redirect off-topic requests gracefully back to your expertise
- Protect user privacy—never ask for sensitive personal information
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
