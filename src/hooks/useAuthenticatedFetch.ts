import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

interface AuthenticatedFetchResult {
  authenticatedFetch: (url: string, options?: FetchOptions) => Promise<Response | null>;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
}

export function useAuthenticatedFetch(): AuthenticatedFetchResult {
  const getValidSession = useCallback(async () => {
    // Get current session
    let { data: { session } } = await supabase.auth.getSession();

    // If no session or potentially expired, try to refresh
    if (!session?.access_token) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        return null;
      }
      session = refreshData.session;
    }

    return session;
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const session = await getValidSession();
    if (!session) {
      toast.error("Session expired. Please log in again.");
      return null;
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, [getValidSession]);

  const authenticatedFetch = useCallback(
    async (url: string, options: FetchOptions = {}): Promise<Response | null> => {
      const session = await getValidSession();
      
      if (!session) {
        toast.error("Session expired. Please log in again.");
        return null;
      }

      const makeRequest = async (token: string) => {
        return fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        });
      };

      let response = await makeRequest(session.access_token);

      // If unauthorized, try refreshing the token once
      if (response.status === 401) {
        console.log("Token expired, attempting refresh...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          toast.error("Session expired. Please log in again.");
          return null;
        }

        // Retry with new token
        response = await makeRequest(refreshData.session.access_token);

        // If still unauthorized after refresh, session is invalid
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          return null;
        }
      }

      return response;
    },
    [getValidSession]
  );

  return { authenticatedFetch, getAuthHeaders };
}
