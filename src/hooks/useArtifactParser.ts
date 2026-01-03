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
    
    // Pattern 1: **DELIVERABLE: [Type]**
    // Pattern: **DELIVERABLE:** followed by artifact name and content until next section or STATE:
    const deliverablePattern = /\*\*DELIVERABLE:\s*([^*\n]+)\*\*\s*([\s\S]*?)(?=\*\*DELIVERABLE:|STATE:|ARCHIVE:|$)/gi;
    
    let match;
    while ((match = deliverablePattern.exec(content)) !== null) {
      const artifactName = match[1].trim().toLowerCase();
      const artifactContent = match[2].trim();
      
      const artifactType = ARTIFACT_TYPE_MAP[artifactName];
      if (artifactType && artifactContent) {
        artifacts.push({
          type: artifactType,
          content: artifactContent,
          status: "draft",
        });
      }
    }

    // Pattern 2: Markdown headers like ## Phase 1 Contract or ## Discovery Report
    const headerPattern = /##\s*(Phase\s*1\s*Contract|Discovery\s*Report|Learner\s*Persona|Design\s*Strategy|Design\s*Blueprint|Scenario\s*Bank|Assessment\s*Kit|Final\s*Audit|Performance\s*(?:Recommendation\s*)?Report)\s*\n([\s\S]*?)(?=##\s*(?:Phase|Discovery|Learner|Design|Scenario|Assessment|Final|Performance)|STATE:|ARCHIVE:|$)/gi;
    
    while ((match = headerPattern.exec(content)) !== null) {
      const artifactName = match[1].trim().toLowerCase();
      const artifactContent = match[2].trim();
      
      const artifactType = ARTIFACT_TYPE_MAP[artifactName];
      if (artifactType && artifactContent && !artifacts.some(a => a.type === artifactType)) {
        artifacts.push({
          type: artifactType,
          content: artifactContent,
          status: "draft",
        });
      }
    }

    // Pattern 3: JSON-like artifact blocks from STATE output
    // STATE: {..., "artifacts": {"phase_1_contract": {...}, ...}}
    const statePattern = /STATE:\s*```json\s*([\s\S]*?)```/i;
    const stateMatch = content.match(statePattern);
    if (stateMatch) {
      try {
        const stateJson = JSON.parse(stateMatch[1]);
        if (stateJson.artifacts && typeof stateJson.artifacts === "object") {
          for (const [key, value] of Object.entries(stateJson.artifacts)) {
            const artifactType = ARTIFACT_TYPE_MAP[key.toLowerCase()];
            if (artifactType && typeof value === "object" && value !== null) {
              const artifactData = value as { content?: string; status?: string };
              if (artifactData.content && !artifacts.some(a => a.type === artifactType)) {
                artifacts.push({
                  type: artifactType,
                  content: artifactData.content,
                  status: artifactData.status === "approved" ? "draft" : "draft",
                });
              }
            }
          }
        }
      } catch {
        // JSON parse failed, ignore
      }
    }

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
