import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Project, Message, Artifact } from "@/types/database";
import { toast } from "sonner";

interface UseWorkspaceDataProps {
  userId: string | undefined;
}

interface UseWorkspaceDataReturn {
  projects: Project[];
  currentProject: Project | null;
  messages: Message[];
  artifacts: Artifact[];
  dataLoading: boolean;
  setCurrentProject: (project: Project | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
  createProject: (name: string, description: string) => Promise<Project | null>;
  refetchProjects: () => Promise<void>;
}

export function useWorkspaceData({ userId }: UseWorkspaceDataProps): UseWorkspaceDataReturn {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
      return;
    }

    const projectsData = data as Project[];
    setProjects(projectsData);

    // Check for project ID in URL query params
    const projectIdFromUrl = searchParams.get("project");
    if (projectIdFromUrl) {
      const projectFromUrl = projectsData.find((p) => p.id === projectIdFromUrl);
      if (projectFromUrl) {
        setCurrentProject(projectFromUrl);
      } else if (projectsData.length > 0 && !currentProject) {
        setCurrentProject(projectsData[0]);
      }
    } else if (projectsData.length > 0 && !currentProject) {
      setCurrentProject(projectsData[0]);
    }

    setDataLoading(false);
  }, [userId, searchParams, currentProject]);

  // Initial fetch
  useEffect(() => {
    if (!userId) return;
    fetchProjects();
  }, [userId, fetchProjects]);

  // Fetch messages and artifacts for current project
  useEffect(() => {
    if (!currentProject) return;

    const fetchProjectData = async () => {
      const [messagesRes, artifactsRes] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("project_id", currentProject.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("artifacts")
          .select("*")
          .eq("project_id", currentProject.id),
      ]);

      if (messagesRes.error) {
        console.error("Error fetching messages:", messagesRes.error);
      } else {
        setMessages(messagesRes.data as Message[]);
      }

      if (artifactsRes.error) {
        console.error("Error fetching artifacts:", artifactsRes.error);
      } else {
        setArtifacts(artifactsRes.data as Artifact[]);
      }
    };

    fetchProjectData();
  }, [currentProject?.id]);

  // Create new project
  const createProject = useCallback(
    async (name: string, description: string): Promise<Project | null> => {
      if (!userId) return null;

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
        console.error("Error creating project:", error);
        toast.error("Failed to create project");
        return null;
      }

      const newProject = data as Project;
      setProjects((prev) => [newProject, ...prev]);
      setCurrentProject(newProject);
      setMessages([]);
      setArtifacts([]);
      toast.success("Project created!");
      return newProject;
    },
    [userId]
  );

  return {
    projects,
    currentProject,
    messages,
    artifacts,
    dataLoading,
    setCurrentProject,
    setMessages,
    setArtifacts,
    createProject,
    refetchProjects: fetchProjects,
  };
}
