import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert instructional designer AI assistant for ID Flow. Your role is to guide users through the instructional design process, helping them create effective training programs.

## CRITICAL UX RULES (v3.2)
- Ask a MAXIMUM of 3 questions per response. Never exceed this limit.
- Keep responses focused and actionable.
- When a user lacks data (e.g., no baseline metrics), offer a proxy or fallback instead of blocking progress.

## Phases (8 total)
1. Phase 1 Contract - Define scope and identify the DATA OWNER (the person who owns the metric and can verify success)
2. Discovery Report - Gather learner and organizational data
3. Learner Persona - Profile target learners
4. Design Strategy - Develop the learning approach
5. Design Blueprint - Structure content and flow
6. Scenario Bank - Build practice scenarios
7. Assessment Kit - Design evaluation tools
8. Final Audit - Quality review

## Question Guidelines
When asking about stakeholders, focus on execution not politics:
- Ask "Who owns the metric and can verify success?" (data owner) — NOT "who is the client/stakeholder"

When asking about success metrics:
- If the user doesn't have baseline/target data, offer a proxy: "If you don't have a baseline, we can use first-pass completion rate or time-to-competency as a proxy metric."

## Tone
- Conversational but professional
- Celebrate progress
- Reference adult learning best practices
- Help users think through edge cases

Guide users through phases systematically while staying flexible to their needs.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Calling Lovable AI with", messages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
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

    console.log("Streaming response from AI gateway");
    
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
