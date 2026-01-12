import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { authLogger } from "@/lib/logger";

interface FetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

interface AuthenticatedFetchResult {
  authenticatedFetch: (url: string, options?: FetchOptions) => Promise<Response | null>;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
}

export function useAuthenticatedFetch(): AuthenticatedFetchResult {
  const isLikelyJwt = (token: string | undefined | null) => {
    if (!token) return false;
    const trimmed = token.trim();
    // JWTs are three base64url parts separated by dots
    return trimmed.split(".").length === 3;
  };

  const getValidSession = useCallback(async () => {
    // Get current session
    let { data: { session } } = await supabase.auth.getSession();

    // Check if session exists and token is not expired (with 60s buffer)
    const isTokenExpired = (expiresAt: number | undefined) => {
      if (!expiresAt) return true;
      const bufferSeconds = 60; // Refresh 60 seconds before expiry
      return Date.now() / 1000 > expiresAt - bufferSeconds;
    };

    // If no session, token missing/invalid, or token expired/expiring soon, try to refresh
    if (!isLikelyJwt(session?.access_token) || isTokenExpired(session?.expires_at)) {
      authLogger.debug("Session missing/invalid or expiring, attempting refresh...", {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        tokenLooksJwt: isLikelyJwt(session?.access_token),
        expiresAt: session?.expires_at,
      });

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        authLogger.error("Session refresh failed", { error: refreshError?.message });
        return null;
      }

      session = refreshData.session;

      // Final sanity check to avoid sending a malformed token to the backend
      if (!isLikelyJwt(session.access_token)) {
        authLogger.error("Refreshed session still has invalid token shape", {
          tokenLength: session.access_token?.length,
        });
        return null;
      }

      authLogger.debug("Session refreshed successfully");
    }

    return session;
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const session = await getValidSession();
    if (!session) {
      toast.error("Session expired. Please log in again.");
      window.location.href = "/auth";
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
        window.location.href = "/auth";
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
        authLogger.debug("Token expired, attempting refresh...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          toast.error("Session expired. Please log in again.");
          window.location.href = "/auth";
          return null;
        }

        // Retry with new token
        response = await makeRequest(refreshData.session.access_token);

        // If still unauthorized after refresh, session is invalid
        if (response.status === 401) {
          toast.error("Session expired. Please log in again.");
          window.location.href = "/auth";
          return null;
        }
      }

      return response;
    },
    [getValidSession]
  );

  return { authenticatedFetch, getAuthHeaders };
}
