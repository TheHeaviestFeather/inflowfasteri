/**
 * Hook for parsing artifacts from AI responses
 * Supports multiple extraction strategies with telemetry
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact, ArtifactType, VALID_ARTIFACT_TYPES, isValidArtifactType } from "@/types/database";
import { parserLogger } from "@/lib/logger";
import { MIN_ARTIFACT_CONTENT_LENGTH } from "@/lib/constants";

/**
 * Map artifact names from prompts to database types
 */
const ARTIFACT_TYPE_MAP: Record<string, ArtifactType> = {
  phase_1_contract: "phase_1_contract",
  "phase 1 contract": "phase_1_contract",
  "phase 1: contract": "phase_1_contract",
  contract: "phase_1_contract",
  discovery_report: "discovery_report",
  "discovery report": "discovery_report",
  "discovery insights report": "discovery_report",
  discovery: "discovery_report",
  learner_persona: "learner_persona",
  "learner persona": "learner_persona",
  persona: "learner_persona",
  design_strategy: "design_strategy",
  "design strategy": "design_strategy",
  "design strategy document": "design_strategy",
  strategy: "design_strategy",
  design_blueprint: "design_blueprint",
  "design blueprint": "design_blueprint",
  blueprint: "design_blueprint",
  scenario_bank: "scenario_bank",
  "scenario bank": "scenario_bank",
  scenarios: "scenario_bank",
  assessment_kit: "assessment_kit",
  "assessment kit": "assessment_kit",
  assessment: "assessment_kit",
  final_audit: "final_audit",
  "final audit": "final_audit",
  "final design audit": "final_audit",
  audit: "final_audit",
  performance_recommendation_report: "performance_recommendation_report",
  "performance recommendation report": "performance_recommendation_report",
  "performance report": "performance_recommendation_report",
  "performance improvement recommendation report": "performance_recommendation_report",
  "recommendation report": "performance_recommendation_report",
  pirr: "performance_recommendation_report",
  prr: "performance_recommendation_report",
};

/**
 * Preview artifact interface with explicit isPreview flag
 */
interface PreviewArtifact extends Artifact {
  isPreview: true;
}

interface ParsedArtifact {
  type: ArtifactType;
  content: string;
  status: "draft" | "pending_approval";
}

interface ParserTelemetry {
  contentLength: number;
  strategiesAttempted: string[];
  strategiesSucceeded: string[];
  artifactsFound: ArtifactType[];
  errors: string[];
}

/**
 * Normalize artifact type string to database type
 */
function normalizeArtifactType(name: string): ArtifactType | null {
  const normalized = name.toLowerCase().trim();
  const mapped = ARTIFACT_TYPE_MAP[normalized];

  if (mapped && VALID_ARTIFACT_TYPES.has(mapped)) {
    return mapped;
  }

  // Direct check if already valid
  if (isValidArtifactType(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Clean artifact content by removing trailing markers
 */
function cleanContent(content: string): string {
  return content
    .replace(/\n---\s*$/g, "")
    .replace(/\n✅\s*Saved\.[\s\S]*$/gi, "")
    .replace(/\nSTATE[\s\S]*$/gi, "")
    .replace(/\nAwaiting approval:[\s\S]*$/gi, "")
    .replace(/\nNext[\s\S]*$/gi, "")
    .replace(/\nCommands:[\s\S]*$/gi, "")
    .trim();
}

/**
 * Extract content between a start marker and end markers
 */
function extractSection(
  content: string,
  startIndex: number,
  endMarkers: RegExp[]
): string {
  let endIndex = content.length;

  for (const marker of endMarkers) {
    const match = content.slice(startIndex).search(marker);
    if (match !== -1 && startIndex + match < endIndex) {
      endIndex = startIndex + match;
    }
  }

  return content.slice(startIndex, endIndex);
}

/**
 * Robust artifact extraction with telemetry and fallback strategies
 */
function extractArtifactContent(content: string): { artifacts: ParsedArtifact[]; telemetry: ParserTelemetry } {
  const artifacts: ParsedArtifact[] = [];
  const foundTypes = new Set<ArtifactType>();
  const telemetry: ParserTelemetry = {
    contentLength: content.length,
    strategiesAttempted: [],
    strategiesSucceeded: [],
    artifactsFound: [],
    errors: [],
  };

  const endMarkers = [
    /\*\*DELIVERABLE:/gi,
    /STATE\s*:?\s*\n```json/gi,
    /\n---\s*\n✅/g,
    /\n✅\s*Saved\./gi,
  ];

  // Strategy 0: Parse structured JSON response with artifact field
  telemetry.strategiesAttempted.push("STRUCTURED_JSON");
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      if (parsed.artifact && typeof parsed.artifact === "object") {
        const art = parsed.artifact;
        const typeName = art.type || art.artifact_type || "";
        const type = normalizeArtifactType(typeName);
        const artContent = art.content || "";
        
        if (type && artContent.length > MIN_ARTIFACT_CONTENT_LENGTH && !foundTypes.has(type)) {
          foundTypes.add(type);
          artifacts.push({ type, content: artContent, status: "draft" });
          telemetry.artifactsFound.push(type);
          telemetry.strategiesSucceeded.push("STRUCTURED_JSON");
        }
      }
    }
  } catch {
    // Not valid JSON, continue with text strategies
  }

  // Strategy 1: **DELIVERABLE: <type>** format (most reliable)
  telemetry.strategiesAttempted.push("DELIVERABLE");
  try {
    const deliverablePattern = /\*\*DELIVERABLE:\s*([^*\n]+)\*\*/gi;
    let match;

    while ((match = deliverablePattern.exec(content)) !== null) {
      const typeName = match[1].trim();
      const startIndex = match.index + match[0].length;
      let artifactContent = extractSection(content, startIndex, endMarkers);
      artifactContent = cleanContent(artifactContent);

      const type = normalizeArtifactType(typeName);
      if (type && artifactContent.length > MIN_ARTIFACT_CONTENT_LENGTH && !foundTypes.has(type)) {
        foundTypes.add(type);
        artifacts.push({ type, content: artifactContent, status: "draft" });
        telemetry.artifactsFound.push(type);
      }
    }
    if (artifacts.length > 0) {
      telemetry.strategiesSucceeded.push("DELIVERABLE");
    }
  } catch (e) {
    telemetry.errors.push(`DELIVERABLE strategy failed: ${(e as Error).message}`);
  }

  // Strategy 2: ## or ### headers with flexible matching
  telemetry.strategiesAttempted.push("HEADER");
  try {
    const headerPattern =
      /#{2,3}\s*(Phase\s*\d*:?\s*)?(Contract|Discovery(?:\s*Insights)?\s*Report|Learner\s*Persona|Design\s*Strategy(?:\s*Document)?|Design\s*Blueprint|Scenario\s*Bank|Assessment\s*Kit|Final\s*(?:Design\s*)?Audit|Performance.*?Report|PIRR|PRR)[:\s]*\n/gi;

    let match;
    const preHeaderCount = artifacts.length;

    while ((match = headerPattern.exec(content)) !== null) {
      const typeName = ((match[1] || "") + match[2]).trim();
      const startIndex = match.index + match[0].length;
      let artifactContent = extractSection(content, startIndex, [
        ...endMarkers,
        /#{2,3}\s*(?:Phase|Contract|Discovery|Learner|Design|Scenario|Assessment|Final|Performance|PIRR|PRR)/gi,
      ]);
      artifactContent = cleanContent(artifactContent);

      const type = normalizeArtifactType(typeName);
      if (type && artifactContent.length > MIN_ARTIFACT_CONTENT_LENGTH && !foundTypes.has(type)) {
        foundTypes.add(type);
        artifacts.push({ type, content: artifactContent, status: "draft" });
        telemetry.artifactsFound.push(type);
      }
    }

    if (artifacts.length > preHeaderCount) {
      telemetry.strategiesSucceeded.push("HEADER");
    }
  } catch (e) {
    telemetry.errors.push(`HEADER strategy failed: ${(e as Error).message}`);
  }

  // Strategy 3: Extract from STATE JSON block
  telemetry.strategiesAttempted.push("STATE_JSON");
  try {
    const stateJsonMatch = content.match(/STATE\s*:?\s*\n```json\s*([\s\S]*?)```/i);
    const preJsonCount = artifacts.length;

    if (stateJsonMatch) {
      const stateJson = JSON.parse(stateJsonMatch[1].trim());
      if (stateJson.artifacts && typeof stateJson.artifacts === "object") {
        for (const [key, value] of Object.entries(stateJson.artifacts)) {
          const type = normalizeArtifactType(key);
          if (type && !foundTypes.has(type)) {
            let contentStr = "";
            if (typeof value === "string" && value.length > MIN_ARTIFACT_CONTENT_LENGTH) {
              contentStr = value;
            } else if (typeof value === "object" && value !== null) {
              const obj = value as Record<string, unknown>;
              if (typeof obj.content === "string" && obj.content.length > MIN_ARTIFACT_CONTENT_LENGTH) {
                contentStr = obj.content;
              }
            }
            if (contentStr) {
              foundTypes.add(type);
              artifacts.push({ type, content: contentStr, status: "draft" });
              telemetry.artifactsFound.push(type);
            }
          }
        }
      }
    }

    if (artifacts.length > preJsonCount) {
      telemetry.strategiesSucceeded.push("STATE_JSON");
    }
  } catch (e) {
    telemetry.errors.push(`STATE_JSON strategy failed: ${(e as Error).message}`);
  }

  // Strategy 4 (Fallback): Fuzzy keyword detection
  telemetry.strategiesAttempted.push("FUZZY_FALLBACK");
  try {
    if (artifacts.length === 0 && content.length > 500) {
      const fuzzyPatterns: { pattern: RegExp; type: ArtifactType }[] = [
        { pattern: /(?:^|\n)#+\s*(?:Phase\s*1|Project)\s*Contract/i, type: "phase_1_contract" },
        { pattern: /(?:^|\n)#+\s*Discovery\s*(?:Insights?)?\s*Report/i, type: "discovery_report" },
        { pattern: /(?:^|\n)#+\s*Learner\s*Persona/i, type: "learner_persona" },
        { pattern: /(?:^|\n)#+\s*Design\s*Strategy/i, type: "design_strategy" },
        { pattern: /(?:^|\n)#+\s*Design\s*Blueprint/i, type: "design_blueprint" },
        { pattern: /(?:^|\n)#+\s*Scenario\s*Bank/i, type: "scenario_bank" },
        { pattern: /(?:^|\n)#+\s*Assessment\s*Kit/i, type: "assessment_kit" },
        { pattern: /(?:^|\n)#+\s*Final\s*(?:Design\s*)?Audit/i, type: "final_audit" },
        { pattern: /(?:^|\n)#+\s*Performance.*Report/i, type: "performance_recommendation_report" },
      ];

      for (const { pattern, type } of fuzzyPatterns) {
        if (foundTypes.has(type)) continue;

        const match = content.match(pattern);
        if (match && match.index !== undefined) {
          const startIndex = match.index + match[0].length;
          let artifactContent = extractSection(content, startIndex, endMarkers);
          artifactContent = cleanContent(artifactContent);

          if (artifactContent.length > MIN_ARTIFACT_CONTENT_LENGTH) {
            foundTypes.add(type);
            artifacts.push({ type, content: artifactContent, status: "draft" });
            telemetry.artifactsFound.push(type);
          }
        }
      }

      if (telemetry.artifactsFound.length > 0) {
        telemetry.strategiesSucceeded.push("FUZZY_FALLBACK");
      }
    }
  } catch (e) {
    telemetry.errors.push(`FUZZY_FALLBACK strategy failed: ${(e as Error).message}`);
  }

  parserLogger.debug("Telemetry", { ...telemetry });

  return { artifacts, telemetry };
}

/**
 * Check if an artifact is a preview (not persisted)
 */
export function isPreviewArtifact(artifact: Artifact): artifact is PreviewArtifact {
  return "isPreview" in artifact && (artifact as PreviewArtifact).isPreview === true;
}

/**
 * Hook for parsing and saving artifacts from AI responses
 * @param projectId - Current project ID
 */
export function useArtifactParser(projectId: string | null) {
  /**
   * Parse artifacts from content string
   */
  const parseArtifactsFromContent = useCallback((content: string): ParsedArtifact[] => {
    const { artifacts } = extractArtifactContent(content);
    return artifacts;
  }, []);

  /**
   * Save or update artifact in database
   */
  const saveArtifact = useCallback(
    async (
      parsedArtifact: ParsedArtifact,
      existingArtifacts: readonly Artifact[]
    ): Promise<Artifact | null> => {
      if (!projectId) {
        parserLogger.warn("No projectId, skipping save");
        return null;
      }

      const persistedArtifacts = existingArtifacts.filter((a) => !isPreviewArtifact(a));
      const existing = persistedArtifacts.find((a) => a.artifact_type === parsedArtifact.type);

      if (existing) {
        if (existing.content === parsedArtifact.content) {
          parserLogger.debug("Content unchanged for:", { type: parsedArtifact.type });
          return existing;
        }

        const newStatus = existing.status === "approved" ? "stale" : "draft";

        parserLogger.debug("Updating artifact:", { type: parsedArtifact.type });

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
          parserLogger.error("Update error:", { error });
          return null;
        }

        return data as Artifact;
      } else {
        parserLogger.debug("Creating artifact:", { type: parsedArtifact.type });

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
          parserLogger.error("Create error:", { error });
          return null;
        }

        return data as Artifact;
      }
    },
    [projectId]
  );

  /**
   * Process complete AI response and save artifacts
   */
  const processAIResponse = useCallback(
    async (response: string, existingArtifacts: Artifact[]): Promise<Artifact[]> => {
      parserLogger.debug("Processing response", { length: response.length });

      const { artifacts: parsedArtifacts, telemetry } = extractArtifactContent(response);

      if (parsedArtifacts.length === 0 && telemetry.contentLength > 500) {
        parserLogger.warn("No artifacts found in substantial response", {
          contentLength: telemetry.contentLength,
          strategiesAttempted: telemetry.strategiesAttempted,
          errors: telemetry.errors,
        });
      }

      parserLogger.debug("Parsed artifacts:", { types: parsedArtifacts.map((a) => a.type) });

      const savedArtifacts: Artifact[] = [];
      const artifactLookup = existingArtifacts.filter((a) => !isPreviewArtifact(a));

      for (const parsed of parsedArtifacts) {
        const saved = await saveArtifact(parsed, artifactLookup);
        if (saved) {
          savedArtifacts.push(saved);
          const idx = artifactLookup.findIndex((a) => a.id === saved.id);
          if (idx >= 0) {
            artifactLookup[idx] = saved;
          } else {
            artifactLookup.push(saved);
          }
        }
      }

      parserLogger.debug("Saved artifacts:", { types: savedArtifacts.map((a) => a.artifact_type) });
      return savedArtifacts;
    },
    [saveArtifact]
  );

  /**
   * Generate preview artifacts during streaming
   */
  const getStreamingArtifactPreview = useCallback(
    (streamingContent: string, existingArtifacts: Artifact[]): Artifact[] => {
      const { artifacts: parsedArtifacts } = extractArtifactContent(streamingContent);

      const result: Artifact[] = existingArtifacts.filter((a) => !isPreviewArtifact(a));

      for (const parsed of parsedArtifacts) {
        const existingIndex = result.findIndex((a) => a.artifact_type === parsed.type);

        if (existingIndex >= 0) {
          result[existingIndex] = {
            ...result[existingIndex],
            content: parsed.content,
          };
        } else {
          const previewArtifact: PreviewArtifact = {
            id: crypto.randomUUID(),
            project_id: projectId || "",
            artifact_type: parsed.type,
            content: parsed.content,
            status: "draft",
            version: 0,
            prompt_version: null,
            updated_by_message_id: null,
            approved_at: null,
            approved_by: null,
            stale_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isPreview: true,
          };
          result.push(previewArtifact);
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
    isPreviewArtifact,
  };
}
