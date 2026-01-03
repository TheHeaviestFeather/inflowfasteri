import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

interface SessionState {
  mode: "STANDARD" | "QUICK";
  threshold_percent: number;
  verbosity: string;
  pipeline_stage: string;
  artifacts: Record<string, unknown>;
  [key: string]: unknown;
}

export function useSessionState(projectId: string | null) {
  // Extract STATE JSON from AI response
  const parseStateFromResponse = useCallback((content: string): SessionState | null => {
    // Pattern 1: STATE: ```json ... ```
    const statePatternCodeBlock = /STATE:\s*```json\s*([\s\S]*?)```/i;
    const match1 = content.match(statePatternCodeBlock);
    if (match1) {
      try {
        return JSON.parse(match1[1]) as SessionState;
      } catch {
        console.log("[SessionState] Failed to parse STATE code block");
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
        console.log("[SessionState] Failed to parse JSON block");
      }
    }

    return null;
  }, []);

  // Save session state to database
  const saveSessionState = useCallback(
    async (state: SessionState): Promise<boolean> => {
      if (!projectId) return false;

      try {
        // Check if state exists
        const { data: existing } = await supabase
          .from("project_state")
          .select("id")
          .eq("project_id", projectId)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("project_state")
            .update({
              state_json: state as unknown as Json,
              updated_at: new Date().toISOString(),
            })
            .eq("project_id", projectId);

          if (error) {
            console.error("Error updating session state:", error);
            return false;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from("project_state")
            .insert({
              project_id: projectId,
              state_json: state as unknown as Json,
            });

          if (error) {
            console.error("Error inserting session state:", error);
            return false;
          }
        }

        console.log("[SessionState] Saved state for project:", projectId);
        return true;
      } catch (e) {
        console.error("Error saving session state:", e);
        return false;
      }
    },
    [projectId]
  );

  // Load session state from database
  const loadSessionState = useCallback(async (): Promise<SessionState | null> => {
    if (!projectId) return null;

    try {
      const { data, error } = await supabase
        .from("project_state")
        .select("state_json")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) {
        console.error("Error loading session state:", error);
        return null;
      }

      if (data?.state_json) {
        console.log("[SessionState] Loaded state for project:", projectId);
        return data.state_json as unknown as SessionState;
      }

      return null;
    } catch (e) {
      console.error("Error loading session state:", e);
      return null;
    }
  }, [projectId]);

  // Process AI response and persist state
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
