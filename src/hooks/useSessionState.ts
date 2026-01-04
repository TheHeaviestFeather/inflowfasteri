/**
 * Hook for managing session state persistence
 * Handles parsing and saving AI conversation state
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { sessionLogger } from "@/lib/logger";

interface SessionState {
  mode: "STANDARD" | "QUICK";
  threshold_percent: number;
  verbosity: string;
  pipeline_stage: string;
  artifacts: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Hook for managing project session state
 * @param projectId - Current project ID
 */
export function useSessionState(projectId: string | null) {
  /**
   * Extract STATE JSON from AI response
   */
  const parseStateFromResponse = useCallback((content: string): SessionState | null => {
    // Pattern 1: STATE (with optional colon) + ```json ... ```
    const statePatternCodeBlock = /STATE\s*:?(?:\r?\n)*\s*```json\s*([\s\S]*?)```/i;
    const match1 = content.match(statePatternCodeBlock);
    if (match1) {
      try {
        return JSON.parse(match1[1]) as SessionState;
      } catch {
        sessionLogger.debug("Failed to parse STATE code block");
      }
    }

    // Pattern 2: Standalone ```json ... ``` with mode/artifacts structure
    const jsonBlockPattern = /```json\s*([\s\S]*?)```/i;
    const match2 = content.match(jsonBlockPattern);
    if (match2) {
      try {
        const parsed = JSON.parse(match2[1]);
        if (parsed.mode && parsed.artifacts) {
          return parsed as SessionState;
        }
      } catch {
        sessionLogger.debug("Failed to parse JSON block");
      }
    }

    return null;
  }, []);

  /**
   * Save session state to database using UPSERT to avoid race conditions
   */
  const saveSessionState = useCallback(
    async (state: SessionState): Promise<boolean> => {
      if (!projectId) return false;

      try {
        const { error } = await supabase
          .from("project_state")
          .upsert(
            {
              project_id: projectId,
              state_json: state as unknown as Json,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "project_id",
              ignoreDuplicates: false,
            }
          );

        if (error) {
          sessionLogger.error("Error upserting session state:", { error });
          return false;
        }

        sessionLogger.debug("Saved state for project:", { projectId });
        return true;
      } catch (e) {
        sessionLogger.error("Error saving session state:", { error: e });
        return false;
      }
    },
    [projectId]
  );

  /**
   * Load session state from database
   */
  const loadSessionState = useCallback(async (): Promise<SessionState | null> => {
    if (!projectId) return null;

    try {
      const { data, error } = await supabase
        .from("project_state")
        .select("state_json")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) {
        sessionLogger.error("Error loading session state:", { error });
        return null;
      }

      if (data?.state_json) {
        sessionLogger.debug("Loaded state for project:", { projectId });
        return data.state_json as unknown as SessionState;
      }

      return null;
    } catch (e) {
      sessionLogger.error("Error loading session state:", { error: e });
      return null;
    }
  }, [projectId]);

  /**
   * Process AI response and persist state
   */
  const processAndSaveState = useCallback(
    async (response: string): Promise<SessionState | null> => {
      const state = parseStateFromResponse(response);
      if (state) {
        await saveSessionState(state);
        return state;
      }
      return null;
    },
    [parseStateFromResponse, saveSessionState]
  );

  return {
    parseStateFromResponse,
    saveSessionState,
    loadSessionState,
    processAndSaveState,
  };
}
