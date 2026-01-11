/**
 * Simplified Artifact Parser V2
 * Uses strict JSON schema instead of multiple parsing strategies
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Artifact, ArtifactType } from "@/types/database";
import { parseAIResponse, AIResponse, AIArtifact } from "@/lib/aiResponseSchema";
import { parserLogger } from "@/lib/logger";

interface ParseResult {
  success: boolean;
  response?: AIResponse;
  error?: string;
  rawContent?: string;
}

/**
 * Preview artifact interface with explicit isPreview flag
 */
interface PreviewArtifact extends Artifact {
  isPreview: true;
}

/**
 * Check if an artifact is a preview (not persisted)
 */
export function isPreviewArtifact(artifact: Artifact): artifact is PreviewArtifact {
  return "isPreview" in artifact && (artifact as PreviewArtifact).isPreview === true;
}

/**
 * Hook for parsing and saving artifacts from AI responses
 */
export function useArtifactParserV2(projectId: string | null) {
  /**
   * Parse AI response using strict schema
   */
  const parseResponse = useCallback((rawResponse: string): ParseResult => {
    const result = parseAIResponse(rawResponse);
    
    if (!result.success) {
      parserLogger.warn("Parse failed", { 
        error: result.error,
        contentLength: rawResponse.length 
      });
    }
    
    return {
      success: result.success,
      response: result.data,
      error: result.error,
      rawContent: result.rawContent,
    };
  }, []);

  /**
   * Save artifact to database
   */
  const saveArtifact = useCallback(
    async (artifact: AIArtifact, existingArtifacts: Artifact[]): Promise<Artifact | null> => {
      if (!projectId) {
        parserLogger.warn("No projectId, skipping save");
        return null;
      }

      const existing = existingArtifacts.find(a => a.artifact_type === artifact.type);

      if (existing) {
        // Update existing artifact
        if (existing.content === artifact.content) {
          parserLogger.debug("Content unchanged", { type: artifact.type });
          return existing;
        }

        const newStatus = existing.status === "approved" ? "stale" : "draft";

        const { data, error } = await supabase
          .from("artifacts")
          .update({
            content: artifact.content,
            status: newStatus,
            stale_reason: existing.status === "approved" ? "Content updated" : null,
            updated_at: new Date().toISOString(),
            version: existing.version + 1,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          parserLogger.error("Update error", { error });
          return null;
        }

        return data as Artifact;
      } else {
        // Create new artifact
        const { data, error } = await supabase
          .from("artifacts")
          .insert({
            project_id: projectId,
            artifact_type: artifact.type as ArtifactType,
            content: artifact.content,
            status: "draft",
            version: 1,
          })
          .select()
          .single();

        if (error) {
          parserLogger.error("Create error", { error });
          return null;
        }

        return data as Artifact;
      }
    },
    [projectId]
  );

  /**
   * Process complete AI response - returns array of saved artifacts
   */
  const processAIResponse = useCallback(
    async (
      rawResponse: string, 
      existingArtifacts: Artifact[]
    ): Promise<Artifact[]> => {
      const parseResult = parseResponse(rawResponse);

      if (!parseResult.success || !parseResult.response) {
        parserLogger.warn("Failed to parse AI response", { error: parseResult.error });
        return [];
      }

      const savedArtifacts: Artifact[] = [];

      if (parseResult.response.artifact) {
        const saved = await saveArtifact(
          parseResult.response.artifact,
          existingArtifacts
        );
        if (saved) {
          savedArtifacts.push(saved);
        }
      }

      return savedArtifacts;
    },
    [parseResponse, saveArtifact]
  );

  /**
   * Generate preview artifacts during streaming
   * Attempts to parse partial JSON and extract artifact preview
   */
  const getStreamingArtifactPreview = useCallback(
    (streamingContent: string, existingArtifacts: Artifact[]): Artifact[] => {
      const result: Artifact[] = existingArtifacts.filter(
        (a) => !("isPreview" in a && (a as PreviewArtifact).isPreview)
      );

      // Try to parse as complete JSON first
      const parseResult = parseResponse(streamingContent);
      
      if (parseResult.success && parseResult.response?.artifact) {
        const art = parseResult.response.artifact;
        const existingIndex = result.findIndex((a) => a.artifact_type === art.type);

        if (existingIndex >= 0) {
          result[existingIndex] = {
            ...result[existingIndex],
            content: art.content,
          };
        } else {
          const previewArtifact: PreviewArtifact = {
            id: `preview-${art.type}`,
            project_id: projectId || "",
            artifact_type: art.type as ArtifactType,
            content: art.content,
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
      } else {
        // Try partial JSON extraction for streaming
        const artifactMatch = streamingContent.match(/"artifact"\s*:\s*\{([^}]*"type"\s*:\s*"([^"]+)"[^}]*"content"\s*:\s*"([^"]*(?:\\.[^"]*)*))/);
        
        if (artifactMatch) {
          const type = artifactMatch[2] as ArtifactType;
          // Unescape JSON string content
          let content = artifactMatch[3];
          try {
            content = JSON.parse(`"${content}"`);
          } catch {
            content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }

          if (content.length > 50) {
            const existingIndex = result.findIndex((a) => a.artifact_type === type);

            if (existingIndex >= 0) {
              result[existingIndex] = {
                ...result[existingIndex],
                content,
              };
            } else {
              const previewArtifact: PreviewArtifact = {
                id: `preview-${type}`,
                project_id: projectId || "",
                artifact_type: type,
                content,
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
        }
      }

      return result;
    },
    [projectId, parseResponse]
  );

  /**
   * Get message text from parsed response (for display)
   */
  const getMessageText = useCallback((response: AIResponse): string => {
    return response.message;
  }, []);

  /**
   * Get session state from parsed response
   */
  const getSessionState = useCallback((response: AIResponse) => {
    return response.state || null;
  }, []);

  return {
    parseResponse,
    processAIResponse,
    saveArtifact,
    getStreamingArtifactPreview,
    getMessageText,
    getSessionState,
  };
}
