/**
 * Hook for managing workspace data: projects, messages, and artifacts
 * Includes pagination support for large datasets
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Project, Message, Artifact } from "@/types/database";
import { toast } from "sonner";
import { workspaceLogger } from "@/lib/logger";
import { parseArrayFiltered, ProjectSchema, MessageSchema, ArtifactSchema } from "@/lib/validators";
import { DEFAULT_PAGE_SIZE, MAX_MESSAGES_FETCH, MAX_ARTIFACTS_FETCH } from "@/lib/constants";
import { useEnsureProfile } from "@/hooks/useEnsureProfile";

interface UseWorkspaceDataProps {
  userId: string | undefined;
}

interface UseWorkspaceDataReturn {
  projects: Project[];
  currentProject: Project | null;
  messages: Message[];
  artifacts: Artifact[];
  dataLoading: boolean;
  messagesLoading: boolean;
  hasMoreMessages: boolean;
  setCurrentProject: (project: Project | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
  createProject: (name: string, description: string) => Promise<Project | null>;
  refetchProjects: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
}

export function useWorkspaceData({ userId }: UseWorkspaceDataProps): UseWorkspaceDataReturn {
  const [searchParams] = useSearchParams();
  const { ensureProfileExists, ensureBillingExists } = useEnsureProfile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);

  /**
   * Fetch user's projects
   */
  const fetchProjects = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(DEFAULT_PAGE_SIZE);

    if (error) {
      workspaceLogger.error("Error fetching projects:", { error });
      toast.error("Failed to load projects");
      return;
    }

    // Validate and filter projects
    const projectsData = parseArrayFiltered(ProjectSchema, data || [], "Projects");
    setProjects(projectsData as Project[]);

    // Check for project ID in URL query params
    const projectIdFromUrl = searchParams.get("project");
    if (projectIdFromUrl) {
      const projectFromUrl = projectsData.find((p) => p.id === projectIdFromUrl);
      if (projectFromUrl) {
        setCurrentProject(projectFromUrl as Project);
      } else if (projectsData.length > 0 && !currentProject) {
        setCurrentProject(projectsData[0] as Project);
      }
    } else if (projectsData.length > 0 && !currentProject) {
      setCurrentProject(projectsData[0] as Project);
    }

    setDataLoading(false);
  }, [userId, searchParams, currentProject]);

  // Initial fetch
  useEffect(() => {
    if (!userId) return;
    fetchProjects();
  }, [userId, fetchProjects]);

  /**
   * Fetch messages and artifacts for current project
   */
  useEffect(() => {
    if (!currentProject) return;

    const fetchProjectData = async () => {
      // Reset pagination state and set loading
      setMessageOffset(0);
      setMessagesLoading(true);

      const [messagesRes, artifactsRes] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("project_id", currentProject.id)
          .order("created_at", { ascending: true })
          .limit(MAX_MESSAGES_FETCH),
        supabase
          .from("artifacts")
          .select("*")
          .eq("project_id", currentProject.id)
          .limit(MAX_ARTIFACTS_FETCH),
      ]);

      if (messagesRes.error) {
        workspaceLogger.error("Error fetching messages:", { error: messagesRes.error });
      } else {
        const validMessages = parseArrayFiltered(MessageSchema, messagesRes.data || [], "Messages");
        setMessages(validMessages as Message[]);
        setHasMoreMessages(messagesRes.data?.length === MAX_MESSAGES_FETCH);
        setMessageOffset(messagesRes.data?.length || 0);
      }

      if (artifactsRes.error) {
        workspaceLogger.error("Error fetching artifacts:", { error: artifactsRes.error });
      } else {
        const validArtifacts = parseArrayFiltered(ArtifactSchema, artifactsRes.data || [], "Artifacts");
        setArtifacts(validArtifacts as Artifact[]);
      }

      setMessagesLoading(false);
    };

    fetchProjectData();
  }, [currentProject?.id]);

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(async () => {
    if (!currentProject || !hasMoreMessages) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: true })
      .range(messageOffset, messageOffset + MAX_MESSAGES_FETCH - 1);

    if (error) {
      workspaceLogger.error("Error loading more messages:", { error });
      toast.error("Failed to load more messages");
      return;
    }

    const validMessages = parseArrayFiltered(MessageSchema, data || [], "Messages");
    setMessages((prev) => [...prev, ...(validMessages as Message[])]);
    setHasMoreMessages(data?.length === MAX_MESSAGES_FETCH);
    setMessageOffset((prev) => prev + (data?.length || 0));
  }, [currentProject, hasMoreMessages, messageOffset]);

  /**
   * Create a new project
   */
  const createProject = useCallback(
    async (name: string, description: string): Promise<Project | null> => {
      if (!userId) return null;

      // Ensure profile and billing exist before creating project (FK constraint)
      // Get user object for the shared ensureProfileExists hook
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        workspaceLogger.error("Cannot create project: user not authenticated");
        toast.error("Please sign in to create a project.");
        return null;
      }

      const [profileExists, billingExists] = await Promise.all([
        ensureProfileExists(user),
        ensureBillingExists(user.id),
      ]);

      if (!profileExists) {
        workspaceLogger.error("Failed to ensure profile exists before project creation");
        toast.error("Unable to set up your account. Please try refreshing the page.");
        return null;
      }

      if (!billingExists) {
        workspaceLogger.warn("Failed to ensure billing exists, continuing anyway");
        // Don't block project creation for billing issues
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) {
        workspaceLogger.error("Error creating project:", { error });
        // Provide more helpful error message for FK constraint violations
        if (error.code === "23503") {
          toast.error("Account setup incomplete. Please try signing out and back in.");
        } else {
          toast.error("Failed to create project. Please try again.");
        }
        return null;
      }

      const validated = ProjectSchema.safeParse(data);
      if (!validated.success) {
        workspaceLogger.warn("Created project failed validation", { issues: validated.error.issues });
      }

      const newProject = (validated.success ? validated.data : data) as Project;
      setProjects((prev) => [newProject, ...prev]);
      setCurrentProject(newProject);
      setMessages([]);
      setArtifacts([]);
      toast.success("Project created!");
      return newProject;
    },
    [userId, ensureProfileExists, ensureBillingExists]
  );

  return {
    projects,
    currentProject,
    messages,
    artifacts,
    dataLoading,
    messagesLoading,
    hasMoreMessages,
    setCurrentProject,
    setMessages,
    setArtifacts,
    createProject,
    refetchProjects: fetchProjects,
    loadMoreMessages,
  };
}
