/**
 * ProjectContext - Project state management
 *
 * Manages project selection, creation, and mode settings.
 * Components that only need project data subscribe here.
 */

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useSessionState } from "@/hooks/useSessionState";
import { Project } from "@/types/database";

export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  projectMode: "standard" | "quick";
  currentStage: string | null;
  dataLoading: boolean;
}

export interface ProjectActions {
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, description: string) => Promise<void>;
  setProjectMode: React.Dispatch<React.SetStateAction<"standard" | "quick">>;
  setCurrentStage: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface ProjectContextValue {
  state: ProjectState;
  actions: ProjectActions;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: React.ReactNode;
  userId: string | undefined;
}

export function ProjectProvider({ children, userId }: ProjectProviderProps) {
  const [projectMode, setProjectMode] = useState<"standard" | "quick">("standard");
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  const {
    projects,
    currentProject,
    dataLoading,
    setCurrentProject,
    createProject: createProjectFn,
  } = useWorkspaceData({ userId });

  const { loadSessionState } = useSessionState(currentProject?.id ?? null);

  // Load session state when project changes
  useEffect(() => {
    if (!currentProject) return;

    const loadState = async () => {
      const sessionState = await loadSessionState();
      if (sessionState?.mode) {
        setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
      } else {
        setProjectMode((currentProject.mode as "standard" | "quick") || "standard");
      }
      if (sessionState?.pipeline_stage) {
        setCurrentStage(sessionState.pipeline_stage);
      }
    };

    loadState();
  }, [currentProject?.id, loadSessionState]);

  const createProject = useCallback(
    async (name: string, description: string) => {
      await createProjectFn(name, description);
    },
    [createProjectFn]
  );

  const state: ProjectState = useMemo(
    () => ({
      projects,
      currentProject,
      projectMode,
      currentStage,
      dataLoading,
    }),
    [projects, currentProject, projectMode, currentStage, dataLoading]
  );

  const actions: ProjectActions = useMemo(
    () => ({
      setCurrentProject,
      createProject,
      setProjectMode,
      setCurrentStage,
    }),
    [setCurrentProject, createProject]
  );

  const contextValue = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within ProjectProvider");
  }
  return context;
}

export function useProjectState(): ProjectState {
  return useProjectContext().state;
}

export function useProjectActions(): ProjectActions {
  return useProjectContext().actions;
}
