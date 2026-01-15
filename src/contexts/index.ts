/**
 * Context exports
 *
 * For better performance, use the focused contexts when you only need
 * a subset of workspace state:
 *
 * - AuthContext: User authentication (user, isAuthLoading, signOut)
 * - ProjectContext: Projects and mode (projects, currentProject, projectMode)
 * - ChatContext: Messages and chat (messages, streamingMessage, sendMessage)
 * - ArtifactContext: Artifacts (artifacts, approveArtifact, mergeArtifacts)
 *
 * Use WorkspaceContext when you need access to everything, but be aware
 * it will re-render on any state change.
 */

export {
  WorkspaceProvider,
  useWorkspace,
  useWorkspaceState,
  useWorkspaceActions,
  type WorkspaceState,
  type WorkspaceActions,
  type WorkspaceContextValue,
  type ParseError,
} from "./WorkspaceContext";

export {
  AuthProvider,
  useAuthContext,
  useAuthState,
  useAuthActions,
  type AuthState,
  type AuthActions,
  type AuthContextValue,
} from "./AuthContext";

export {
  ProjectProvider,
  useProjectContext,
  useProjectState,
  useProjectActions,
  type ProjectState,
  type ProjectActions,
  type ProjectContextValue,
} from "./ProjectContext";

export {
  ChatProvider,
  useChatContext,
  useChatState,
  useChatActions,
  type ChatState,
  type ChatActions,
  type ChatContextValue,
} from "./ChatContext";

export {
  ArtifactProvider,
  useArtifactContext,
  useArtifactState,
  useArtifactActions,
  type ArtifactState,
  type ArtifactActions,
  type ArtifactContextValue,
} from "./ArtifactContext";
