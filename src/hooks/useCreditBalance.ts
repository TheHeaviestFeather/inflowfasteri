import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CreditBalance {
  credits: number;
  tier: string;
}

export function useCreditBalance() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_billing")
        .select("credits, tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching credit balance:", error);
        // Default to 50 credits for new users
        setBalance({ credits: 50, tier: "free" });
        return;
      }

      if (data) {
        setBalance({ credits: data.credits, tier: data.tier });
      } else {
        // No billing record yet - user gets 50 credits by default
        setBalance({ credits: 50, tier: "free" });
      }
    } catch (error) {
      console.error("Error in fetchBalance:", error);
      setBalance({ credits: 50, tier: "free" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscribe to realtime updates for credit changes
  useEffect(() => {
    if (!user) return;

    fetchBalance();

    // Subscribe to changes in user_billing table
    const channel = supabase
      .channel(`credits-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_billing",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as { credits: number; tier: string };
          setBalance({ credits: newData.credits, tier: newData.tier });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchBalance]);

  return {
    balance,
    credits: balance?.credits ?? 0,
    tier: balance?.tier ?? "free",
    loading,
    refetch: fetchBalance,
    isLow: (balance?.credits ?? 0) <= 10,
    isEmpty: (balance?.credits ?? 0) === 0,
  };
}
