import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact, ArtifactType } from "@/types/database";

// Map artifact names from the prompt to database types
const ARTIFACT_TYPE_MAP: Record<string, ArtifactType> = {
  "phase_1_contract": "phase_1_contract",
  "phase 1 contract": "phase_1_contract",
  "contract": "phase_1_contract",
  "discovery_report": "discovery_report",
  "discovery report": "discovery_report",
  "discovery": "discovery_report",
  "learner_persona": "learner_persona",
  "learner persona": "learner_persona",
  "persona": "learner_persona",
  "design_strategy": "design_strategy",
  "design strategy": "design_strategy",
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
  "audit": "final_audit",
  "performance_recommendation_report": "performance_recommendation_report",
  "performance recommendation report": "performance_recommendation_report",
  "performance report": "performance_recommendation_report",
};

interface ParsedArtifact {
  type: ArtifactType;
  content: string;
  status: "draft" | "pending_approval";
}

export function useArtifactParser(projectId: string | null) {
  // Parse streaming content for artifact blocks
  const parseArtifactsFromContent = useCallback((content: string): ParsedArtifact[] => {
    const artifacts: ParsedArtifact[] = [];
    
    console.log("[ArtifactParser] Parsing content length:", content.length);
    
    // Pattern 1: **DELIVERABLE: [Type]**
    const deliverablePattern = /\*\*DELIVERABLE:\s*([^*\n]+)\*\*\s*([\s\S]*?)(?=\*\*DELIVERABLE:|STATE:|ARCHIVE:|```json|$)/gi;
    
    let match;
    while ((match = deliverablePattern.exec(content)) !== null) {
      const artifactName = match[1].trim().toLowerCase();
      const artifactContent = match[2].trim();
      
      const artifactType = ARTIFACT_TYPE_MAP[artifactName];
      if (artifactType && artifactContent) {
        console.log("[ArtifactParser] Found DELIVERABLE:", artifactName);
        artifacts.push({
          type: artifactType,
          content: artifactContent,
          status: "draft",
        });
      }
    }

    // Pattern 2: Markdown headers (## or ###) like ### Phase 1 Contract: or ## Discovery Report
    const headerPattern = /#{2,3}\s*(Phase\s*1\s*Contract|Discovery\s*Report|Learner\s*Persona|Design\s*Strategy|Design\s*Blueprint|Scenario\s*Bank|Assessment\s*Kit|Final\s*Audit|Performance\s*(?:Recommendation\s*)?Report)[:\s]*\n([\s\S]*?)(?=#{2,3}\s*(?:Phase|Discovery|Learner|Design|Scenario|Assessment|Final|Performance)|STATE:|ARCHIVE:|```json|---\s*\n✅|$)/gi;
    
    while ((match = headerPattern.exec(content)) !== null) {
      const artifactName = match[1].trim().toLowerCase();
      let artifactContent = match[2].trim();
      
      // Clean up: remove trailing "---" separator if present
      artifactContent = artifactContent.replace(/\n---\s*$/, "").trim();
      
      const artifactType = ARTIFACT_TYPE_MAP[artifactName];
      if (artifactType && artifactContent && !artifacts.some(a => a.type === artifactType)) {
        console.log("[ArtifactParser] Found header artifact:", artifactName);
        artifacts.push({
          type: artifactType,
          content: artifactContent,
          status: "draft",
        });
      }
    }

    // Pattern 3: JSON block with artifacts object (may or may not have STATE: prefix)
    const jsonPatterns = [
      /STATE:\s*```json\s*([\s\S]*?)```/i,
      /```json\s*([\s\S]*?)```/i,
    ];
    
    for (const pattern of jsonPatterns) {
      const jsonMatch = content.match(pattern);
      if (jsonMatch) {
        try {
          const stateJson = JSON.parse(jsonMatch[1]);
          if (stateJson.artifacts && typeof stateJson.artifacts === "object") {
            console.log("[ArtifactParser] Found JSON artifacts block");
            for (const [key, value] of Object.entries(stateJson.artifacts)) {
              const normalizedKey = key.toLowerCase().replace(/_/g, " ");
              const artifactType = ARTIFACT_TYPE_MAP[normalizedKey] || ARTIFACT_TYPE_MAP[key.toLowerCase()];
              if (artifactType && typeof value === "object" && value !== null) {
                const artifactData = value as Record<string, unknown>;
                // Build content from object properties if no direct content field
                let contentStr = "";
                if (typeof artifactData.content === "string") {
                  contentStr = artifactData.content;
                } else {
                  // Format object properties as content
                  contentStr = Object.entries(artifactData)
                    .map(([k, v]) => {
                      if (Array.isArray(v)) {
                        return `**${k}:**\n${v.map(item => `  - ${item}`).join("\n")}`;
                      }
                      return `**${k}:** ${v}`;
                    })
                    .join("\n\n");
                }
                
                if (contentStr && !artifacts.some(a => a.type === artifactType)) {
                  console.log("[ArtifactParser] Extracted from JSON:", key);
                  artifacts.push({
                    type: artifactType,
                    content: contentStr,
                    status: "draft",
                  });
                }
              }
            }
          }
        } catch (e) {
          console.log("[ArtifactParser] JSON parse failed:", e);
        }
        break; // Only process first matching JSON block
      }
    }

    console.log("[ArtifactParser] Total artifacts found:", artifacts.length);
    return artifacts;
  }, []);

  // Save or update artifact in database
  const saveArtifact = useCallback(
    async (
      parsedArtifact: ParsedArtifact,
      existingArtifacts: Artifact[]
    ): Promise<Artifact | null> => {
      if (!projectId) return null;

      const existing = existingArtifacts.find(
        (a) => a.artifact_type === parsedArtifact.type
      );

      if (existing) {
        // Update existing artifact
        const { data, error } = await supabase
          .from("artifacts")
          .update({
            content: parsedArtifact.content,
            status: "draft",
            updated_at: new Date().toISOString(),
            version: existing.version + 1,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating artifact:", error);
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
        // Create new artifact
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
          console.error("Error creating artifact:", error);
          return null;
        }

        return data as Artifact;
      }
    },
    [projectId]
  );

  // Process full AI response and extract/save artifacts
  const processAIResponse = useCallback(
    async (
      response: string,
      existingArtifacts: Artifact[]
    ): Promise<Artifact[]> => {
      const parsedArtifacts = parseArtifactsFromContent(response);
      const updatedArtifacts: Artifact[] = [];

      for (const parsed of parsedArtifacts) {
        const saved = await saveArtifact(parsed, existingArtifacts);
        if (saved) {
          updatedArtifacts.push(saved);
        }
      }

      return updatedArtifacts;
    },
    [parseArtifactsFromContent, saveArtifact]
  );

  // Get live preview of artifacts from streaming content (without saving)
  const getStreamingArtifactPreview = useCallback(
    (streamingContent: string, existingArtifacts: Artifact[]): Artifact[] => {
      const parsedArtifacts = parseArtifactsFromContent(streamingContent);
      
      // Merge parsed artifacts with existing ones for preview
      const mergedArtifacts = [...existingArtifacts];
      
      for (const parsed of parsedArtifacts) {
        const existingIndex = mergedArtifacts.findIndex(
          (a) => a.artifact_type === parsed.type
        );
        
        if (existingIndex >= 0) {
          // Update existing with preview content
          mergedArtifacts[existingIndex] = {
            ...mergedArtifacts[existingIndex],
            content: parsed.content,
            status: "draft",
          };
        } else {
          // Add as temporary preview artifact
          mergedArtifacts.push({
            id: `preview-${parsed.type}`,
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
      
      return mergedArtifacts;
    },
    [parseArtifactsFromContent, projectId]
  );

  return {
    parseArtifactsFromContent,
    processAIResponse,
    getStreamingArtifactPreview,
  };
}
