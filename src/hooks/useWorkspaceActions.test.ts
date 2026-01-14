/**
 * Unit tests for useWorkspaceActions hook
 * Tests action handlers in isolation with mocked dependencies
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceActions } from "./useWorkspaceActions";
import { Message, Artifact } from "@/types/database";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("useWorkspaceActions", () => {
  // Mock data
  const mockProject = { id: "project-123", mode: "standard" };
  const mockUser = { id: "user-123" };
  const mockMessages: Message[] = [
    { id: "msg-1", project_id: "project-123", role: "user", content: "Hello", sequence: 1, created_at: "2024-01-01", prompt_version: null },
    { id: "msg-2", project_id: "project-123", role: "assistant", content: "Hi there", sequence: 2, created_at: "2024-01-01", prompt_version: null },
  ];
  const mockArtifacts: Artifact[] = [
    {
      id: "artifact-1",
      project_id: "project-123",
      artifact_type: "phase_1_contract",
      content: "Test content",
      status: "draft",
      version: 1,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      prompt_version: null,
      updated_by_message_id: null,
      approved_at: null,
      approved_by: null,
      stale_reason: null,
    },
  ];

  // Mock functions
  let mockSendMessage: Mock;
  let mockRetryLastMessage: Mock;
  let mockProcessAIResponse: Mock;
  let mockMergeArtifacts: Mock;
  let mockApproveArtifact: Mock;
  let mockParseResponse: Mock;
  let mockGetSessionState: Mock;
  let mockProcessAndSaveState: Mock;
  let mockSetMessages: Mock;
  let mockSetProjectMode: Mock;
  let mockSetCurrentStage: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSendMessage = vi.fn(async (content, messages, onResponse) => {
      await onResponse('{"message": "Test response"}');
    });
    mockRetryLastMessage = vi.fn(async (messages, onResponse) => {
      await onResponse('{"message": "Retry response"}');
    });
    mockProcessAIResponse = vi.fn().mockResolvedValue([]);
    mockMergeArtifacts = vi.fn();
    mockApproveArtifact = vi.fn().mockResolvedValue(true);
    mockParseResponse = vi.fn().mockReturnValue({ success: true, response: {} });
    mockGetSessionState = vi.fn().mockReturnValue(null);
    mockProcessAndSaveState = vi.fn().mockResolvedValue({});
    mockSetMessages = vi.fn();
    mockSetProjectMode = vi.fn();
    mockSetCurrentStage = vi.fn();
  });

  const createHookProps = (overrides = {}) => ({
    currentProject: mockProject,
    user: mockUser,
    messages: mockMessages,
    artifacts: mockArtifacts,
    isLoading: false,
    sendMessage: mockSendMessage,
    retryLastMessage: mockRetryLastMessage,
    processAIResponse: mockProcessAIResponse,
    mergeArtifacts: mockMergeArtifacts,
    approveArtifact: mockApproveArtifact,
    parseResponse: mockParseResponse,
    getSessionState: mockGetSessionState,
    processAndSaveState: mockProcessAndSaveState,
    setMessages: mockSetMessages,
    setProjectMode: mockSetProjectMode,
    setCurrentStage: mockSetCurrentStage,
    ...overrides,
  });

  describe("handleSendMessage", () => {
    it("should send message and process response", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Test message");
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        "Test message",
        mockMessages,
        expect.any(Function)
      );
      expect(mockProcessAIResponse).toHaveBeenCalled();
    });

    it("should not send if no project", async () => {
      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ currentProject: null }))
      );

      await act(async () => {
        await result.current.handleSendMessage("Test message");
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should not send if no user", async () => {
      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ user: null }))
      );

      await act(async () => {
        await result.current.handleSendMessage("Test message");
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should clear parse error before sending", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      // First, trigger a parse error
      mockProcessAIResponse.mockRejectedValueOnce(new Error("Parse failed"));
      
      await act(async () => {
        await result.current.handleSendMessage("First message");
      });

      expect(result.current.parseError).not.toBeNull();

      // Now send another message - error should be cleared
      mockProcessAIResponse.mockResolvedValueOnce([]);
      
      await act(async () => {
        await result.current.handleSendMessage("Second message");
      });

      expect(result.current.parseError).toBeNull();
    });

    it("should merge artifacts when response contains them", async () => {
      const newArtifact: Artifact = {
        ...mockArtifacts[0],
        id: "new-artifact",
        artifact_type: "discovery_report",
      };
      mockProcessAIResponse.mockResolvedValue([newArtifact]);

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Generate report");
      });

      expect(mockMergeArtifacts).toHaveBeenCalledWith([newArtifact]);
    });

    it("should update project mode from session state", async () => {
      mockGetSessionState.mockReturnValue({ mode: "quick" });

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Switch mode");
      });

      expect(mockSetProjectMode).toHaveBeenCalledWith("quick");
    });

    it("should update current stage from session state", async () => {
      mockGetSessionState.mockReturnValue({ pipeline_stage: "design_blueprint" });

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Next stage");
      });

      expect(mockSetCurrentStage).toHaveBeenCalledWith("design_blueprint");
    });

    it("should set parse error when artifact field found but no artifacts parsed", async () => {
      mockSendMessage.mockImplementation(async (content, messages, onResponse) => {
        await onResponse('{"artifact": {"type": "test"}}');
      });
      mockProcessAIResponse.mockResolvedValue([]);

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Generate");
      });

      expect(result.current.parseError).toMatchObject({
        message: expect.stringContaining("artifact"),
      });
    });
  });

  describe("handleRetryLastMessage", () => {
    it("should retry and process response", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleRetryLastMessage();
      });

      expect(mockRetryLastMessage).toHaveBeenCalledWith(
        mockMessages,
        expect.any(Function)
      );
      expect(mockProcessAIResponse).toHaveBeenCalled();
    });

    it("should not retry if no project", async () => {
      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ currentProject: null }))
      );

      await act(async () => {
        await result.current.handleRetryLastMessage();
      });

      expect(mockRetryLastMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleRetryParse", () => {
    it("should re-parse last raw response", async () => {
      const newArtifact: Artifact = {
        ...mockArtifacts[0],
        id: "parsed-artifact",
      };
      
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      // First send a message to set lastRawResponse
      await act(async () => {
        await result.current.handleSendMessage("Generate");
      });

      // Setup mock for retry
      mockProcessAIResponse.mockResolvedValue([newArtifact]);

      await act(async () => {
        await result.current.handleRetryParse();
      });

      expect(mockProcessAIResponse).toHaveBeenCalled();
      expect(mockMergeArtifacts).toHaveBeenCalledWith([newArtifact]);
    });

    it("should set error if no artifacts parsed on retry", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      // First send a message to set lastRawResponse
      await act(async () => {
        await result.current.handleSendMessage("Generate");
      });

      // Setup mock for retry to return empty
      mockProcessAIResponse.mockResolvedValue([]);

      await act(async () => {
        await result.current.handleRetryParse();
      });

      expect(result.current.parseError).toMatchObject({
        message: expect.stringContaining("No artifacts"),
      });
    });

    it("should not retry if no raw response", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleRetryParse();
      });

      // Should not call processAIResponse since there's no raw response
      expect(mockProcessAIResponse).not.toHaveBeenCalled();
    });
  });

  describe("handleApproveArtifact", () => {
    it("should approve artifact and send APPROVE command", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleApproveArtifact("artifact-1");
      });

      expect(mockApproveArtifact).toHaveBeenCalledWith("artifact-1");
      expect(mockSendMessage).toHaveBeenCalledWith(
        "APPROVE",
        mockMessages,
        expect.any(Function)
      );
    });

    it("should not send APPROVE if approval fails", async () => {
      mockApproveArtifact.mockResolvedValue(false);

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleApproveArtifact("artifact-1");
      });

      expect(mockApproveArtifact).toHaveBeenCalledWith("artifact-1");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleRetryGeneration", () => {
    it("should send CONTINUE command", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleRetryGeneration();
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        "CONTINUE",
        mockMessages,
        expect.any(Function)
      );
    });

    it("should not retry if loading", async () => {
      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ isLoading: true }))
      );

      await act(async () => {
        await result.current.handleRetryGeneration();
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleGenerateArtifact", () => {
    it("should send generate command with formatted type", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleGenerateArtifact("design_blueprint");
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        "Please generate the design blueprint now.",
        mockMessages,
        expect.any(Function)
      );
    });

    it("should not generate if no project", async () => {
      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ currentProject: null }))
      );

      await act(async () => {
        await result.current.handleGenerateArtifact("design_blueprint");
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleRegenerateArtifact", () => {
    it("should send regenerate command with formatted type", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleRegenerateArtifact("learner_persona");
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        "Please regenerate the learner persona with fresh content and improvements.",
        mockMessages,
        expect.any(Function)
      );
    });

    it("should not regenerate if loading", async () => {
      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ isLoading: true }))
      );

      await act(async () => {
        await result.current.handleRegenerateArtifact("learner_persona");
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("handleClearHistory", () => {
    it("should soft-delete old messages keeping last 4", async () => {
      const manyMessages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        project_id: "project-123",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
        sequence: i + 1,
        created_at: "2024-01-01",
        prompt_version: null,
      }));

      const { supabase } = await import("@/integrations/supabase/client");
      const mockUpdate = vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
      }));
      (supabase.from as Mock).mockReturnValue({ update: mockUpdate });

      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ messages: manyMessages }))
      );

      await act(async () => {
        await result.current.handleClearHistory();
      });

      expect(supabase.from).toHaveBeenCalledWith("messages");
      expect(mockSetMessages).toHaveBeenCalled();
    });

    it("should not clear if 4 or fewer messages", async () => {
      const fewMessages: Message[] = mockMessages.slice(0, 2);

      const { result } = renderHook(() =>
        useWorkspaceActions(createHookProps({ messages: fewMessages }))
      );

      const { supabase } = await import("@/integrations/supabase/client");

      await act(async () => {
        await result.current.handleClearHistory();
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe("clearParseError", () => {
    it("should clear parse error state", async () => {
      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      // Trigger a parse error
      mockProcessAIResponse.mockRejectedValueOnce(new Error("Parse failed"));
      
      await act(async () => {
        await result.current.handleSendMessage("Message");
      });

      expect(result.current.parseError).not.toBeNull();

      // Clear it
      act(() => {
        result.current.clearParseError();
      });

      expect(result.current.parseError).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should set parse error when processAIResponse throws", async () => {
      mockProcessAIResponse.mockRejectedValue(new Error("Processing failed"));

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Generate");
      });

      expect(result.current.parseError).toMatchObject({
        message: "Processing failed",
      });
    });

    it("should store raw response in parse error", async () => {
      const rawResponse = '{"broken": json}';
      mockSendMessage.mockImplementation(async (content, messages, onResponse) => {
        await onResponse(rawResponse);
      });
      mockProcessAIResponse.mockRejectedValue(new Error("Invalid JSON"));

      const { result } = renderHook(() => useWorkspaceActions(createHookProps()));

      await act(async () => {
        await result.current.handleSendMessage("Generate");
      });

      expect(result.current.parseError?.rawContent).toBe(rawResponse);
    });
  });
});
