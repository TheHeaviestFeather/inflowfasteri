/**
 * WorkspaceContext - Centralized state management for workspace
 *
 * This is a composition layer that provides a unified API for workspace state.
 * For better performance, consider using the focused contexts instead:
 * - AuthContext: User authentication state
 * - ProjectContext: Project selection and mode
 * - ChatContext: Messages and streaming
 * - ArtifactContext: Artifacts and approvals
 *
 * Components that only need a subset of state should use the focused contexts
 * to avoid unnecessary re-renders.
 */

import React, { createContext, useContext, useCallback, useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useArtifactParserV2 } from "@/hooks/useArtifactParserV2";
import { useSessionState } from "@/hooks/useSessionState";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
import { useArtifactManagement } from "@/hooks/useArtifactManagement";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useWorkspaceActions as useWorkspaceActionsHook } from "@/hooks/useWorkspaceActions";
import { Message, Artifact, Project } from "@/types/database";
import { ChatError } from "@/hooks/useChat";

// ============================================
// Types
// ============================================

export interface ParseError {
  message: string;
  rawResponse?: string;
}

export interface WorkspaceState {
  // Auth
  user: { id: string; email?: string } | null;
  isAuthLoading: boolean;
  
  // Projects
  projects: Project[];
  currentProject: Project | null;
  
  // Messages
  messages: Message[];
  messagesLoading: boolean;
  streamingMessage: string;
  
  // Artifacts
  artifacts: Artifact[];
  displayArtifacts: Artifact[];
  
  // UI State
  projectMode: "standard" | "quick";
  currentStage: string | null;
  isLoading: boolean;
  error: ChatError | null;
  parseError: ParseError | null;
  
  // Loading states
  dataLoading: boolean;
}

export interface WorkspaceActions {
  // Project actions
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, description: string) => Promise<void>;
  
  // Message actions
  handleSendMessage: (content: string) => Promise<void>;
  handleRetryLastMessage: () => void;
  handleClearHistory: () => Promise<void>;
  
  // Artifact actions
  handleApproveArtifact: (artifactId: string) => Promise<void>;
  handleRetryGeneration: (artifactType: string) => void;
  handleGenerateArtifact: (artifactType: string) => void;
  handleRegenerateArtifact: (artifactType: string) => void;
  
  // Error handling
  clearError: () => void;
  clearParseError: () => void;
  handleRetryParse: () => void;
  
  // Auth
  signOut: () => void;
  
  // Artifact updates
  onArtifactUpdated: (artifact: Artifact) => void;
}

export interface WorkspaceContextValue {
  state: WorkspaceState;
  actions: WorkspaceActions;
}

// ============================================
// Context
// ============================================

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  // Project state
  const [projectMode, setProjectMode] = useState<"standard" | "quick">("standard");
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  // Data management hooks
  const {
    projects,
    currentProject,
    messages,
    artifacts,
    dataLoading,
    messagesLoading,
    setCurrentProject,
    setMessages,
    setArtifacts,
    createProject: createProjectFn,
  } = useWorkspaceData({ userId: user?.id });

  // Chat hook with reconnect handler
  const {
    sendMessage,
    isLoading,
    streamingMessage,
    error,
    clearError,
    retryLastMessage,
    handleReconnect,
  } = useChat(currentProject?.id ?? null);

  // Online status with auto-retry on reconnect
  useOnlineStatus({ onReconnect: handleReconnect });

  // Artifact parsing
  const { processAIResponse, getStreamingArtifactPreview, getSessionState, parseResponse } =
    useArtifactParserV2(currentProject?.id ?? null);

  // Session state
  const { processAndSaveState, loadSessionState } = useSessionState(currentProject?.id ?? null);

  // Ref to current artifacts for synchronous reads - avoids Promise-based hack
  const artifactsRef = useRef<Artifact[]>(artifacts);
  artifactsRef.current = artifacts;

  // Artifact management with cascading approval
  const { approveArtifact, mergeArtifacts, handleRealtimeArtifact } = useArtifactManagement({
    userId: user?.id,
    setArtifacts,
    mode: projectMode,
    artifactsRef,
  });

  // Action handlers
  const {
    parseError,
    handleSendMessage,
    handleRetryLastMessage,
    handleRetryParse,
    handleApproveArtifact,
    handleRetryGeneration,
    handleGenerateArtifact,
    handleRegenerateArtifact,
    handleClearHistory,
    clearParseError,
  } = useWorkspaceActionsHook({
    currentProject,
    user,
    messages,
    artifacts,
    isLoading,
    sendMessage,
    retryLastMessage,
    processAIResponse,
    mergeArtifacts,
    approveArtifact,
    parseResponse,
    getSessionState,
    processAndSaveState,
    setMessages,
    setProjectMode,
    setCurrentStage,
  });

  // Realtime message handler
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    },
    [setMessages]
  );

  // Set up realtime subscriptions
  useWorkspaceRealtime({
    projectId: currentProject?.id,
    onNewMessage: handleNewMessage,
    onArtifactChange: handleRealtimeArtifact,
  });

  // Compute live artifact preview during streaming
  // Threshold of 50 characters ensures we have enough content to parse JSON structure
  // before attempting preview extraction (avoids wasted regex operations on fragments)
  const STREAMING_PREVIEW_THRESHOLD = 50;
  const displayArtifacts = useMemo(() => {
    if (streamingMessage && streamingMessage.length > STREAMING_PREVIEW_THRESHOLD) {
      const preview = getStreamingArtifactPreview(streamingMessage, artifacts);
      if (preview.length >= artifacts.length) {
        return preview;
      }
    }
    return artifacts;
  }, [streamingMessage, artifacts, getStreamingArtifactPreview]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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

  // Create project handler
  const createProject = useCallback(
    async (name: string, description: string) => {
      await createProjectFn(name, description);
    },
    [createProjectFn]
  );

  // Artifact update handler
  const onArtifactUpdated = useCallback(
    (artifact: Artifact) => {
      setArtifacts((prev) => prev.map((a) => (a.id === artifact.id ? artifact : a)));
    },
    [setArtifacts]
  );

  // Build context value
  const state: WorkspaceState = useMemo(
    () => ({
      user: user ? { id: user.id, email: user.email } : null,
      isAuthLoading: authLoading,
      projects,
      currentProject,
      messages,
      messagesLoading,
      streamingMessage,
      artifacts,
      displayArtifacts,
      projectMode,
      currentStage,
      isLoading,
      error,
      parseError,
      dataLoading,
    }),
    [
      user,
      authLoading,
      projects,
      currentProject,
      messages,
      messagesLoading,
      streamingMessage,
      artifacts,
      displayArtifacts,
      projectMode,
      currentStage,
      isLoading,
      error,
      parseError,
      dataLoading,
    ]
  );

  const actions: WorkspaceActions = useMemo(
    () => ({
      setCurrentProject,
      createProject,
      handleSendMessage,
      handleRetryLastMessage,
      handleClearHistory,
      handleApproveArtifact,
      handleRetryGeneration,
      handleGenerateArtifact,
      handleRegenerateArtifact,
      clearError,
      clearParseError,
      handleRetryParse,
      signOut,
      onArtifactUpdated,
    }),
    [
      setCurrentProject,
      createProject,
      handleSendMessage,
      handleRetryLastMessage,
      handleClearHistory,
      handleApproveArtifact,
      handleRetryGeneration,
      handleGenerateArtifact,
      handleRegenerateArtifact,
      clearError,
      clearParseError,
      handleRetryParse,
      signOut,
      onArtifactUpdated,
    ]
  );

  const contextValue = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

// Convenience hooks for common patterns
export function useWorkspaceState(): WorkspaceState {
  return useWorkspace().state;
}

export function useWorkspaceActions(): WorkspaceActions {
  return useWorkspace().actions;
}
