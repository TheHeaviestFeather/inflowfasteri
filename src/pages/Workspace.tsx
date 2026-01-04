import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useArtifactParser } from "@/hooks/useArtifactParser";
import { useSessionState } from "@/hooks/useSessionState";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { ArtifactCanvas } from "@/components/workspace/ArtifactCanvas";
import { EmptyProjectState } from "@/components/workspace/EmptyProjectState";
import { Project, Message, Artifact } from "@/types/database";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Workspace() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [projectMode, setProjectMode] = useState<"standard" | "quick">("standard");
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  const { sendMessage, isLoading, streamingMessage } = useChat(currentProject?.id ?? null);
  const { processAIResponse, getStreamingArtifactPreview } = useArtifactParser(currentProject?.id ?? null);
  const { processAndSaveState, loadSessionState } = useSessionState(currentProject?.id ?? null);

  // Compute live artifact preview during streaming - memoized properly
  const displayArtifacts = useMemo(() => {
    if (streamingMessage && streamingMessage.length > 50) {
      const preview = getStreamingArtifactPreview(streamingMessage, artifacts);
      // Only return preview if it has more content than existing
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

  // Fetch projects
  useEffect(() => {
    if (!user) return;

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching projects:", error);
        toast.error("Failed to load projects");
      } else {
        setProjects(data as Project[]);
        
        // Check for project ID in URL query params
        const projectIdFromUrl = searchParams.get("project");
        if (projectIdFromUrl) {
          const projectFromUrl = (data as Project[]).find(p => p.id === projectIdFromUrl);
          if (projectFromUrl) {
            setCurrentProject(projectFromUrl);
          } else if (data.length > 0 && !currentProject) {
            setCurrentProject(data[0] as Project);
          }
        } else if (data.length > 0 && !currentProject) {
          setCurrentProject(data[0] as Project);
        }
      }
      setDataLoading(false);
    };

    fetchProjects();
  }, [user, searchParams]);

  // Fetch messages, artifacts, and session state for current project
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

      // Load session state to get mode and stage
      const sessionState = await loadSessionState();
      if (sessionState?.mode) {
        setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
      } else {
        // Fall back to project mode
        setProjectMode(currentProject.mode || "standard");
      }
      if (sessionState?.pipeline_stage) {
        setCurrentStage(sessionState.pipeline_stage);
      }
    };

    fetchProjectData();

    // Subscribe to realtime messages
    const messagesChannel = supabase
      .channel(`messages-${currentProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${currentProject.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    // Subscribe to realtime artifacts for status updates
    const artifactsChannel = supabase
      .channel(`artifacts-${currentProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "artifacts",
          filter: `project_id=eq.${currentProject.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newArtifact = payload.new as Artifact;
            setArtifacts((prev) => {
              if (prev.some((a) => a.id === newArtifact.id)) return prev;
              return [...prev, newArtifact];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedArtifact = payload.new as Artifact;
            setArtifacts((prev) =>
              prev.map((a) => (a.id === updatedArtifact.id ? updatedArtifact : a))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(artifactsChannel);
    };
  }, [currentProject, loadSessionState]);

  const handleCreateProject = async (name: string, description: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    } else {
      const newProject = data as Project;
      setProjects((prev) => [newProject, ...prev]);
      setCurrentProject(newProject);
      setMessages([]);
      toast.success("Project created!");
    }
  };

  const handleSendMessage = useCallback(async (content: string) => {
    if (!currentProject || !user) return;

    await sendMessage(content, messages, async (response) => {
      console.log("[Workspace] Processing AI response, length:", response.length);
      
      // Process AI response for artifacts
      const newArtifacts = await processAIResponse(response, artifacts);
      console.log("[Workspace] New artifacts from response:", newArtifacts.length);
      
      if (newArtifacts.length > 0) {
        setArtifacts((prev) => {
          const updated = [...prev];
          for (const newArtifact of newArtifacts) {
            const existingIndex = updated.findIndex((a) => a.id === newArtifact.id);
            if (existingIndex >= 0) {
              updated[existingIndex] = newArtifact;
            } else {
              // Also check by artifact_type to avoid duplicates
              const typeIndex = updated.findIndex((a) => a.artifact_type === newArtifact.artifact_type);
              if (typeIndex >= 0) {
                updated[typeIndex] = newArtifact;
              } else {
                updated.push(newArtifact);
              }
            }
          }
          return updated;
        });
      }

      // Process and save session state
      const sessionState = await processAndSaveState(response);
      if (sessionState?.mode) {
        setProjectMode(sessionState.mode.toLowerCase() as "standard" | "quick");
      }
      if (sessionState?.pipeline_stage) {
        setCurrentStage(sessionState.pipeline_stage);
      }

      // Show toast if AI response mentioned a deliverable but no artifacts were parsed
      const mentionsDeliverable = /\*\*DELIVERABLE:/i.test(response) || 
        /#{2,3}\s*(Phase\s*\d*:?\s*)?(Contract|Discovery|Learner|Design|Scenario|Assessment|Final|Performance)/i.test(response);
      
      if (mentionsDeliverable && newArtifacts.length === 0) {
        console.warn("[Workspace] Deliverable mentioned but no artifacts parsed");
        toast.error("Artifact parsing issue", {
          description: "The AI generated content but it couldn't be parsed. Check the chat for the full response.",
        });
      }
    });
  }, [currentProject, user, messages, artifacts, sendMessage, processAIResponse, processAndSaveState]);

  const handleApproveArtifact = async (artifactId: string) => {
    const { error } = await supabase
      .from("artifacts")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      })
      .eq("id", artifactId);

    if (error) {
      toast.error("Failed to approve artifact");
    } else {
      setArtifacts((prev) =>
        prev.map((a) =>
          a.id === artifactId
            ? { ...a, status: "approved" as const, approved_at: new Date().toISOString() }
            : a
        )
      );
      toast.success("Artifact approved!");
      
      // Send APPROVE command to move to next stage
      await handleSendMessage("APPROVE");
    }
  };

  const handleRetryGeneration = async () => {
    if (!currentProject || !user || isLoading) return;
    await handleSendMessage("CONTINUE");
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show empty project state when no projects exist
  if (projects.length === 0) {
    return (
      <div className="h-screen flex flex-col">
        <WorkspaceHeader
          projects={projects}
          currentProject={null}
          onSelectProject={setCurrentProject}
          onCreateProject={handleCreateProject}
          userEmail={user?.email}
          onSignOut={signOut}
        />
        <EmptyProjectState onCreateProject={handleCreateProject} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <WorkspaceHeader
        projects={projects}
        currentProject={currentProject}
        onSelectProject={setCurrentProject}
        onCreateProject={handleCreateProject}
        userEmail={user?.email}
        onSignOut={signOut}
      />
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          streamingMessage={streamingMessage}
        />
        <ArtifactCanvas
          artifacts={displayArtifacts}
          onApprove={handleApproveArtifact}
          onRetry={handleRetryGeneration}
          isStreaming={!!streamingMessage}
          streamingMessage={streamingMessage}
          mode={projectMode}
          currentStage={currentStage}
        />
      </div>
    </div>
  );
}
