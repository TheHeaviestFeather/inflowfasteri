/**
 * Hook to ensure user profile and billing records exist
 * This is a fallback for cases where the database trigger might have failed
 */

import { useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authLogger } from "@/lib/logger";

interface UseEnsureProfileReturn {
  ensureProfileExists: (user: User) => Promise<boolean>;
  ensureBillingExists: (userId: string) => Promise<boolean>;
}

export function useEnsureProfile(): UseEnsureProfileReturn {
  /**
   * Ensure a profile record exists for the user
   * Returns true if profile exists or was created successfully
   */
  const ensureProfileExists = useCallback(async (user: User): Promise<boolean> => {
    if (!user?.id || !user?.email) {
      authLogger.error("Cannot ensure profile: missing user id or email");
      return false;
    }

    try {
      // First, check if profile exists
      const { data: existing, error: selectError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (selectError) {
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
        authLogger.error("Error creating profile:", { error: insertError });
        return false;
      }

      authLogger.info("Profile created successfully");
      return true;
    } catch (error) {
      authLogger.error("Unexpected error in ensureProfileExists:", { error });
      return false;
    }
  }, []);

  /**
   * Ensure a billing record exists for the user
   * Returns true if billing exists or was created successfully
   */
  const ensureBillingExists = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) {
      authLogger.error("Cannot ensure billing: missing user id");
      return false;
    }

    try {
      // First, check if billing exists
      const { data: existing, error: selectError } = await supabase
        .from("user_billing")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
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
          tier: "free",
          credits_used: 0,
          credits_limit: 50,
        });

      if (insertError) {
        // If it's a duplicate key error, that's fine - another request created it
        if (insertError.code === "23505") {
          authLogger.debug("Billing was created by concurrent request");
          return true;
        }
        authLogger.error("Error creating billing:", { error: insertError });
        return false;
      }

      authLogger.info("Billing created successfully");
      return true;
    } catch (error) {
      authLogger.error("Unexpected error in ensureBillingExists:", { error });
      return false;
    }
  }, []);

  return { ensureProfileExists, ensureBillingExists };
}
