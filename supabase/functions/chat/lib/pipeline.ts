/**
 * Pipeline context utilities for injecting project state into prompts
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ARTIFACT_SEQUENCE, ArtifactType } from "./constants.ts";
import { log } from "./logger.ts";

interface ArtifactInfo {
  status: string;
  updated_at: string;
  contentPreview: string;
}

/**
 * Build pipeline context from project artifacts
 */
export async function buildPipelineContext(
  serviceClient: SupabaseClient,
  projectId: string,
  requestId: string
): Promise<string> {
  try {
    // Fetch artifacts with content summary for better context
    const { data: artifactRows } = await serviceClient
      .from("artifacts")
      .select("artifact_type, status, updated_at, content")
      .eq("project_id", projectId);

    const byType = new Map<string, ArtifactInfo>();
    for (const row of artifactRows ?? []) {
      if (row?.artifact_type) {
        // Extract first 200 chars of content for context
        const content = (row as { content?: string }).content ?? "";
        const preview = content.substring(0, 200).replace(/\n/g, " ").trim();
        byType.set(row.artifact_type, {
          status: (row as { status?: string }).status ?? "draft",
          updated_at: (row as { updated_at?: string }).updated_at ?? "",
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

    return `

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
  } catch (e) {
    log("warn", "Failed to compute pipeline context", {
      requestId,
      error: e instanceof Error ? e.message : "Unknown",
    });
    return "";
  }
}
