import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact, ArtifactType } from "@/types/database";

// Map artifact names from the prompt to database types
const ARTIFACT_TYPE_MAP: Record<string, ArtifactType> = {
  "phase_1_contract": "phase_1_contract",
  "phase 1 contract": "phase_1_contract",
  "phase 1: contract": "phase_1_contract",
  "contract": "phase_1_contract",
  "discovery_report": "discovery_report",
  "discovery report": "discovery_report",
  "discovery insights report": "discovery_report",
  "discovery": "discovery_report",
  "learner_persona": "learner_persona",
  "learner persona": "learner_persona",
  "persona": "learner_persona",
  "design_strategy": "design_strategy",
  "design strategy": "design_strategy",
  "design strategy document": "design_strategy",
  "strategy": "design_strategy",
  "design_blueprint": "design_blueprint",
  "design blueprint": "design_blueprint",
  "blueprint": "design_blueprint",
  "scenario_bank": "scenario_bank",
  "scenario bank": "scenario_bank",
  "scenarios": "scenario_bank",
  "assessment_kit": "assessment_kit",
  "assessment kit": "assessment_kit",
  "assessment": "assessment_kit",
  "final_audit": "final_audit",
  "final audit": "final_audit",
  "final design audit": "final_audit",
  "audit": "final_audit",
  "performance_recommendation_report": "performance_recommendation_report",
  "performance recommendation report": "performance_recommendation_report",
  "performance report": "performance_recommendation_report",
  "performance improvement recommendation report": "performance_recommendation_report",
  "recommendation report": "performance_recommendation_report",
  "pirr": "performance_recommendation_report",
  "prr": "performance_recommendation_report",
};

interface ParsedArtifact {
  type: ArtifactType;
  content: string;
  status: "draft" | "pending_approval";
}

/**
 * Normalize artifact type string to database type
 */
function normalizeArtifactType(name: string): ArtifactType | null {
  const normalized = name.toLowerCase().trim();
  return ARTIFACT_TYPE_MAP[normalized] || null;
}

/**
 * Extract artifact content from AI response
 * Supports multiple formats the AI might use
 */
function extractArtifactContent(content: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = [];
  const foundTypes = new Set<ArtifactType>();

  console.log("[Parser] Extracting from content length:", content.length);

  // Pattern 1: **DELIVERABLE: <type>** followed by content until STATE or next DELIVERABLE
  const deliverableRegex = /\*\*DELIVERABLE:\s*([^*\n]+)\*\*\s*([\s\S]*?)(?=\*\*DELIVERABLE:|STATE\s*\n```json|\n---\s*\n✅|$)/gi;
  let match;
  
  while ((match = deliverableRegex.exec(content)) !== null) {
    const typeName = match[1].trim();
    let artifactContent = match[2].trim();
    
    // Clean trailing markers
    artifactContent = artifactContent
      .replace(/\n---\s*$/g, '')
      .replace(/\n✅\s*Saved\.[\s\S]*$/gi, '')
      .replace(/\nSTATE[\s\S]*$/gi, '')
      .trim();
    
    const type = normalizeArtifactType(typeName);
    if (type && artifactContent.length > 20 && !foundTypes.has(type)) {
      console.log("[Parser] Found DELIVERABLE pattern:", typeName, "->", type);
      foundTypes.add(type);
      artifacts.push({ type, content: artifactContent, status: "draft" });
    }
  }

  // Pattern 2: ## or ### headers like "## Phase 1: Contract" or "### Design Strategy"
  const headerRegex = /#{2,3}\s*(Phase\s*\d*:?\s*)?(Contract|Discovery(?:\s*Insights)?\s*Report|Learner\s*Persona|Design\s*Strategy(?:\s*Document)?|Design\s*Blueprint|Scenario\s*Bank|Assessment\s*Kit|Final\s*(?:Design\s*)?Audit|Performance.*?Report|PIRR|PRR)[:\s]*\n([\s\S]*?)(?=#{2,3}\s*(?:Phase|Contract|Discovery|Learner|Design|Scenario|Assessment|Final|Performance|PIRR|PRR)|STATE\s*\n```json|\n---\s*\n✅|$)/gi;
  
  while ((match = headerRegex.exec(content)) !== null) {
    const typeName = (match[1] || '') + match[2];
    let artifactContent = match[3].trim();
    
    // Clean trailing markers
    artifactContent = artifactContent
      .replace(/\n---\s*$/g, '')
      .replace(/\n✅\s*Saved\.[\s\S]*$/gi, '')
      .replace(/\nSTATE[\s\S]*$/gi, '')
      .trim();
    
    const type = normalizeArtifactType(typeName);
    if (type && artifactContent.length > 20 && !foundTypes.has(type)) {
      console.log("[Parser] Found header pattern:", typeName, "->", type);
      foundTypes.add(type);
      artifacts.push({ type, content: artifactContent, status: "draft" });
    }
  }

  // Pattern 3: Extract from STATE JSON block if present
  const stateJsonMatch = content.match(/STATE\s*\n```json\s*([\s\S]*?)```/i);
  if (stateJsonMatch) {
    try {
      const stateJson = JSON.parse(stateJsonMatch[1].trim());
      if (stateJson.artifacts && typeof stateJson.artifacts === "object") {
        for (const [key, value] of Object.entries(stateJson.artifacts)) {
          const type = normalizeArtifactType(key);
          if (type && !foundTypes.has(type)) {
            let contentStr = "";
            if (typeof value === "string" && value.length > 20) {
              contentStr = value;
            } else if (typeof value === "object" && value !== null) {
              const obj = value as Record<string, unknown>;
              if (typeof obj.content === "string") {
                contentStr = obj.content;
              }
            }
            if (contentStr) {
              console.log("[Parser] Found in STATE JSON:", key, "->", type);
              foundTypes.add(type);
              artifacts.push({ type, content: contentStr, status: "draft" });
            }
          }
        }
      }
    } catch (e) {
      console.log("[Parser] STATE JSON parse failed:", (e as Error).message);
    }
  }

  console.log("[Parser] Total artifacts found:", artifacts.length);
  return artifacts;
}

export function useArtifactParser(projectId: string | null) {
  
  // Parse artifacts from content (used for both streaming and final)
  const parseArtifactsFromContent = useCallback((content: string): ParsedArtifact[] => {
    return extractArtifactContent(content);
  }, []);

  // Save or update artifact in database
  const saveArtifact = useCallback(
    async (
      parsedArtifact: ParsedArtifact,
      existingArtifacts: Artifact[]
    ): Promise<Artifact | null> => {
      if (!projectId) {
        console.warn("[Parser] No projectId, skipping save");
        return null;
      }

      const existing = existingArtifacts.find(
        (a) => a.artifact_type === parsedArtifact.type
      );

      if (existing) {
        // Skip if content is identical
        if (existing.content === parsedArtifact.content) {
          console.log("[Parser] Content unchanged for:", parsedArtifact.type);
          return existing;
        }

        const newStatus = existing.status === "approved" ? "stale" : "draft";
        
        console.log("[Parser] Updating artifact:", parsedArtifact.type);

        const { data, error } = await supabase
          .from("artifacts")
          .update({
            content: parsedArtifact.content,
            status: newStatus,
            stale_reason: existing.status === "approved" ? "Content updated" : null,
            updated_at: new Date().toISOString(),
            version: existing.version + 1,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("[Parser] Update error:", error);
          return null;
        }

        // Save version history
        await supabase.from("artifact_versions").insert({
          artifact_id: existing.id,
          project_id: projectId,
          artifact_type: parsedArtifact.type,
          content: existing.content,
          version: existing.version,
        });

        return data as Artifact;
      } else {
        // Create new
        console.log("[Parser] Creating artifact:", parsedArtifact.type);

        const { data, error } = await supabase
          .from("artifacts")
          .insert({
            project_id: projectId,
            artifact_type: parsedArtifact.type,
            content: parsedArtifact.content,
            status: "draft",
            version: 1,
          })
          .select()
          .single();

        if (error) {
          console.error("[Parser] Create error:", error);
          return null;
        }

        return data as Artifact;
      }
    },
    [projectId]
  );

  // Process complete AI response and save artifacts
  const processAIResponse = useCallback(
    async (response: string, existingArtifacts: Artifact[]): Promise<Artifact[]> => {
      console.log("[Parser] Processing response, length:", response.length);

      const parsedArtifacts = extractArtifactContent(response);
      console.log("[Parser] Parsed artifacts:", parsedArtifacts.map(a => a.type));

      const savedArtifacts: Artifact[] = [];

      for (const parsed of parsedArtifacts) {
        const saved = await saveArtifact(parsed, existingArtifacts);
        if (saved) {
          savedArtifacts.push(saved);
          // Update existingArtifacts for subsequent saves
          const idx = existingArtifacts.findIndex(a => a.id === saved.id);
          if (idx >= 0) {
            existingArtifacts[idx] = saved;
          } else {
            existingArtifacts.push(saved);
          }
        }
      }

      console.log("[Parser] Saved artifacts:", savedArtifacts.map(a => a.artifact_type));
      return savedArtifacts;
    },
    [saveArtifact]
  );

  // Generate preview artifacts from streaming content (no database save)
  const getStreamingArtifactPreview = useCallback(
    (streamingContent: string, existingArtifacts: Artifact[]): Artifact[] => {
      const parsedArtifacts = extractArtifactContent(streamingContent);
      
      // Start with a copy of existing artifacts
      const result = [...existingArtifacts];
      
      for (const parsed of parsedArtifacts) {
        const existingIndex = result.findIndex(a => a.artifact_type === parsed.type);
        
        if (existingIndex >= 0) {
          // Update existing with streaming content
          result[existingIndex] = {
            ...result[existingIndex],
            content: parsed.content,
          };
        } else {
          // Add preview artifact with temporary ID
          result.push({
            id: `preview-${parsed.type}-${Date.now()}`,
            project_id: projectId || "",
            artifact_type: parsed.type,
            content: parsed.content,
            status: "draft",
            version: 1,
            prompt_version: null,
            updated_by_message_id: null,
            approved_at: null,
            approved_by: null,
            stale_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      
      return result;
    },
    [projectId]
  );

  return {
    parseArtifactsFromContent,
    processAIResponse,
    getStreamingArtifactPreview,
  };
}
