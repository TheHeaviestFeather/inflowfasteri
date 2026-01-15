/**
 * ArtifactContext - Artifact state management
 *
 * Manages artifact state, streaming previews, and artifact operations.
 * Components that only need artifact data subscribe here.
 */

import React, { createContext, useContext, useMemo, useRef, useCallback } from "react";
import { useArtifactParserV2 } from "@/hooks/useArtifactParserV2";
import { useArtifactManagement } from "@/hooks/useArtifactManagement";
import { Artifact } from "@/types/database";

export interface ArtifactState {
  artifacts: Artifact[];
  displayArtifacts: Artifact[];
}

export interface ArtifactActions {
  approveArtifact: (artifactId: string) => Promise<boolean>;
  mergeArtifacts: (newArtifacts: Artifact[]) => void;
  handleRealtimeArtifact: (artifact: Artifact, eventType: "INSERT" | "UPDATE") => void;
  onArtifactUpdated: (artifact: Artifact) => void;
  processAIResponse: (response: string, artifacts: Artifact[]) => unknown;
  getStreamingArtifactPreview: (content: string, artifacts: Artifact[]) => Artifact[];
  getSessionState: () => unknown;
  parseResponse: (response: string) => unknown;
}

export interface ArtifactContextValue {
  state: ArtifactState;
  actions: ArtifactActions;
  /** Ref to current artifacts for synchronous reads - avoids Promise-based state hack */
  artifactsRef: React.RefObject<Artifact[]>;
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

interface ArtifactProviderProps {
  children: React.ReactNode;
  projectId: string | null;
  userId: string | undefined;
  projectMode: "standard" | "quick";
  artifacts: Artifact[];
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
  streamingMessage: string;
}

export function ArtifactProvider({
  children,
  projectId,
  userId,
  projectMode,
  artifacts,
  setArtifacts,
  streamingMessage,
}: ArtifactProviderProps) {
  // Ref to current artifacts for synchronous reads
  const artifactsRef = useRef<Artifact[]>(artifacts);
  artifactsRef.current = artifacts;

  const { processAIResponse, getStreamingArtifactPreview, getSessionState, parseResponse } =
    useArtifactParserV2(projectId);

  const { approveArtifact, mergeArtifacts, handleRealtimeArtifact } = useArtifactManagement({
    userId,
    setArtifacts,
    mode: projectMode,
    artifactsRef, // Pass ref for synchronous reads
  });

  // Compute live artifact preview during streaming
  const displayArtifacts = useMemo(() => {
    if (streamingMessage && streamingMessage.length > 50) {
      const preview = getStreamingArtifactPreview(streamingMessage, artifacts);
      if (preview.length >= artifacts.length) {
        return preview;
      }
    }
    return artifacts;
  }, [streamingMessage, artifacts, getStreamingArtifactPreview]);

  const onArtifactUpdated = useCallback(
    (artifact: Artifact) => {
      setArtifacts((prev) => prev.map((a) => (a.id === artifact.id ? artifact : a)));
    },
    [setArtifacts]
  );

  const state: ArtifactState = useMemo(
    () => ({
      artifacts,
      displayArtifacts,
    }),
    [artifacts, displayArtifacts]
  );

  const actions: ArtifactActions = useMemo(
    () => ({
      approveArtifact,
      mergeArtifacts,
      handleRealtimeArtifact,
      onArtifactUpdated,
      processAIResponse,
      getStreamingArtifactPreview,
      getSessionState,
      parseResponse,
    }),
    [
      approveArtifact,
      mergeArtifacts,
      handleRealtimeArtifact,
      onArtifactUpdated,
      processAIResponse,
      getStreamingArtifactPreview,
      getSessionState,
      parseResponse,
    ]
  );

  const contextValue = useMemo(
    () => ({ state, actions, artifactsRef }),
    [state, actions]
  );

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifactContext(): ArtifactContextValue {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error("useArtifactContext must be used within ArtifactProvider");
  }
  return context;
}

export function useArtifactState(): ArtifactState {
  return useArtifactContext().state;
}

export function useArtifactActions(): ArtifactActions {
  return useArtifactContext().actions;
}
