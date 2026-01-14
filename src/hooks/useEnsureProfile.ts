/**
 * Hook to ensure user profile and billing records exist
 * This is a fallback for cases where the database trigger might have failed
 */

import { useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authLogger } from "@/lib/logger";
import {
  DEFAULT_CREDITS_LIMIT,
  DEFAULT_BILLING_TIER,
  MAX_RETRY_ATTEMPTS,
  calculateBackoffDelay,
} from "@/lib/constants";

/**
 * Check if an error is transient and should be retried
 */
function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: number; code?: string; message?: string };
  // Network errors or 5xx server errors
  if (err.status && err.status >= 500 && err.status < 600) return true;
  // Supabase-specific transient codes
  if (err.code === 'PGRST301' || err.code === 'PGRST502') return true;
  // Network failure indicators
  if (err.message?.includes('fetch') || err.message?.includes('network')) return true;
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface UseEnsureProfileReturn {
  ensureProfileExists: (user: User) => Promise<boolean>;
  ensureBillingExists: (userId: string) => Promise<boolean>;
}

export function useEnsureProfile(): UseEnsureProfileReturn {
  /**
   * Ensure a profile record exists for the user
   * Returns true if profile exists or was created successfully
   * Includes retry logic for transient failures
   */
  const ensureProfileExists = useCallback(async (user: User): Promise<boolean> => {
    if (!user?.id || !user?.email) {
      authLogger.error("Cannot ensure profile: missing user id or email");
      return false;
    }

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // First, check if profile exists
        const { data: existing, error: selectError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (selectError) {
          if (isTransientError(selectError) && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = calculateBackoffDelay(attempt);
            authLogger.debug("Transient error checking profile, retrying...", { attempt, delay });
            await sleep(delay);
            continue;
          }
          authLogger.error("Error checking for existing profile:", { error: selectError });
          return false;
        }

        if (existing) {
          return true; // Profile already exists
        }

        // Profile doesn't exist, create it
        authLogger.info("Profile missing, creating for user:", { userId: user.id });

        const fullName = user.user_metadata?.full_name || null;

        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            full_name: fullName,
          });

        if (insertError) {
          // If it's a duplicate key error, that's fine - another request created it
          if (insertError.code === "23505") {
            authLogger.debug("Profile was created by concurrent request");
            return true;
          }
          if (isTransientError(insertError) && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = calculateBackoffDelay(attempt);
            authLogger.debug("Transient error creating profile, retrying...", { attempt, delay });
            await sleep(delay);
            continue;
          }
          authLogger.error("Error creating profile:", { error: insertError });
          return false;
        }

        authLogger.info("Profile created successfully");
        return true;
      } catch (error) {
        if (isTransientError(error) && attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = calculateBackoffDelay(attempt);
          authLogger.debug("Transient error in ensureProfileExists, retrying...", { attempt, delay });
          await sleep(delay);
          continue;
        }
        authLogger.error("Unexpected error in ensureProfileExists:", { error });
        return false;
      }
    }
    return false;
  }, []);

  /**
   * Ensure a billing record exists for the user
   * Returns true if billing exists or was created successfully
   * Includes retry logic for transient failures
   */
  const ensureBillingExists = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) {
      authLogger.error("Cannot ensure billing: missing user id");
      return false;
    }

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // First, check if billing exists
        const { data: existing, error: selectError } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (selectError) {
          if (isTransientError(selectError) && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = calculateBackoffDelay(attempt);
            authLogger.debug("Transient error checking billing, retrying...", { attempt, delay });
            await sleep(delay);
            continue;
          }
          authLogger.error("Error checking for existing billing:", { error: selectError });
          return false;
        }

        if (existing) {
          return true; // Billing already exists
        }

        // Billing doesn't exist, create it
        authLogger.info("Billing missing, creating for user:", { userId });

        const { error: insertError } = await supabase
          .from("user_billing")
          .insert({
            user_id: userId,
            tier: DEFAULT_BILLING_TIER,
            credits_used: 0,
            credits_limit: DEFAULT_CREDITS_LIMIT,
          });

        if (insertError) {
          // If it's a duplicate key error, that's fine - another request created it
          if (insertError.code === "23505") {
            authLogger.debug("Billing was created by concurrent request");
            return true;
          }
          if (isTransientError(insertError) && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = calculateBackoffDelay(attempt);
            authLogger.debug("Transient error creating billing, retrying...", { attempt, delay });
            await sleep(delay);
            continue;
          }
          authLogger.error("Error creating billing:", { error: insertError });
          return false;
        }

        authLogger.info("Billing created successfully");
        return true;
      } catch (error) {
        if (isTransientError(error) && attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = calculateBackoffDelay(attempt);
          authLogger.debug("Transient error in ensureBillingExists, retrying...", { attempt, delay });
          await sleep(delay);
          continue;
        }
        authLogger.error("Unexpected error in ensureBillingExists:", { error });
        return false;
      }
    }
    return false;
  }, []);

  return { ensureProfileExists, ensureBillingExists };
}
