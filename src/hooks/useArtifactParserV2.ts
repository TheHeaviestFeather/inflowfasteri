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
   * Process complete AI response
   */
  const processAIResponse = useCallback(
    async (
      rawResponse: string, 
      existingArtifacts: Artifact[]
    ): Promise<{
      parsedResponse: AIResponse | null;
      savedArtifact: Artifact | null;
      parseError: string | null;
    }> => {
      const parseResult = parseResponse(rawResponse);

      if (!parseResult.success || !parseResult.response) {
        return {
          parsedResponse: null,
          savedArtifact: null,
          parseError: parseResult.error || "Unknown parse error",
        };
      }

      let savedArtifact: Artifact | null = null;

      if (parseResult.response.artifact) {
        savedArtifact = await saveArtifact(
          parseResult.response.artifact,
          existingArtifacts
        );
      }

      return {
        parsedResponse: parseResult.response,
        savedArtifact,
        parseError: null,
      };
    },
    [parseResponse, saveArtifact]
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
    getMessageText,
    getSessionState,
  };
}
