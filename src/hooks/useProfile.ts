import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { profileLogger } from "@/lib/logger";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        profileLogger.error("Error fetching profile", { error });
        return;
      }

      setProfile(data);
    } catch (error) {
      profileLogger.error("Error in fetchProfile", { error });
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<Profile, "full_name" | "timezone">>) => {
    if (!profile) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update profile. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast({
        title: "Success",
        description: "Profile updated successfully.",
      });
      return true;
    } catch (error) {
      profileLogger.error("Error updating profile", { error });
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [profile, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    saving,
    updateProfile,
    refetch: fetchProfile,
  };
}
