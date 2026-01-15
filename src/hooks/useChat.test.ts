/**
 * Integration tests for useChat hook
 * Tests message sending, streaming, error handling, and retry logic
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat, ChatError } from "./useChat";

// Mock supabase
const mockInsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
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
  chatLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock authenticated fetch
const mockAuthenticatedFetch = vi.fn();
vi.mock("./useAuthenticatedFetch", () => ({
  useAuthenticatedFetch: () => ({
    authenticatedFetch: mockAuthenticatedFetch,
  }),
}));

// Helper to create a mock SSE stream response
function createMockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Helper to create SSE data line
function sseData(content: string): string {
  return `data: {"choices":[{"delta":{"content":"${content}"}}]}\n\n`;
}

describe("useChat", () => {
  const projectId = "project-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendMessage", () => {
    it("should send message and handle streaming response", async () => {
      const mockStream = createMockSSEStream([
        sseData("Hello"),
        sseData(" world"),
        sseData("!"),
        "data: [DONE]\n\n",
      ]);

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test message", [], onComplete);
      });

      expect(mockInsert).toHaveBeenCalledTimes(2); // User + assistant messages
      expect(onComplete).toHaveBeenCalledWith("Hello world!");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.streamingMessage).toBe("");
    });

    it("should validate empty messages", async () => {
      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();
      const { toast } = await import("sonner");

      await act(async () => {
        await result.current.sendMessage("   ", [], onComplete);
      });

      expect(toast.error).toHaveBeenCalledWith("Message cannot be empty");
      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it("should validate message length", async () => {
      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();
      const { toast } = await import("sonner");

      const longMessage = "a".repeat(50001);

      await act(async () => {
        await result.current.sendMessage(longMessage, [], onComplete);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("less than")
      );
      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it("should not send if no projectId", async () => {
      const { result } = renderHook(() => useChat(null));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it("should handle duplicate message insert gracefully", async () => {
      mockInsert
        .mockResolvedValueOnce({ error: { code: "23505" } }) // Duplicate user message
        .mockResolvedValueOnce({ error: null }); // Assistant message succeeds

      const mockStream = createMockSSEStream([
        sseData("Response"),
        "data: [DONE]\n\n",
      ]);

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      // Should continue despite duplicate error
      expect(onComplete).toHaveBeenCalledWith("Response");
    });

    it("should handle insert error", async () => {
      mockInsert.mockResolvedValue({ error: { code: "PGRST116" } });
      const { toast } = await import("sonner");

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to send message");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle rate limit errors (429)", async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Rate limited" }),
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(result.current.error).toMatchObject({
        type: "rate_limit",
        canRetry: true,
      });
    });

    it("should handle credits exhausted errors (402)", async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ error: "No credits" }),
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(result.current.error).toMatchObject({
        type: "credits",
        canRetry: false,
      });
    });

    it("should handle server errors (5xx)", async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal error" }),
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(result.current.error).toMatchObject({
        type: "server",
        canRetry: true,
      });
    });

    it("should handle null response from authenticatedFetch", async () => {
      mockAuthenticatedFetch.mockResolvedValue(null);

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(result.current.isLoading).toBe(false);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should handle missing response body", async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: null,
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(result.current.error).toMatchObject({
        type: "stream_interrupted",
        canRetry: true,
      });
    });
  });

  describe("cancelRequest", () => {
    it("should abort ongoing request", async () => {
      // Create a slow stream that we can cancel
      let resolveStream: () => void;
      const slowStream = new ReadableStream({
        start(controller) {
          new Promise<void>((resolve) => {
            resolveStream = resolve;
          }).then(() => controller.close());
        },
      });

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: slowStream,
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      // Start request
      const sendPromise = act(async () => {
        result.current.sendMessage("Test", [], onComplete);
      });

      // Wait for loading to start
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Cancel
      act(() => {
        result.current.cancelRequest();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.streamingMessage).toBe("");
    });
  });

  describe("clearError", () => {
    it("should clear error state", async () => {
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useChat(projectId));

      await act(async () => {
        await result.current.sendMessage("Test", [], vi.fn());
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("retryLastMessage", () => {
    it("should retry with last message content", async () => {
      // First request fails
      mockAuthenticatedFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Original message", [], onComplete);
      });

      expect(result.current.error).not.toBeNull();

      // Setup successful retry
      const mockStream = createMockSSEStream([
        sseData("Retry success"),
        "data: [DONE]\n\n",
      ]);
      mockAuthenticatedFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      await act(async () => {
        await result.current.retryLastMessage([], onComplete);
      });

      expect(onComplete).toHaveBeenCalledWith("Retry success");
    });

    it("should not retry if no last message", async () => {
      const { result } = renderHook(() => useChat(projectId));

      await act(async () => {
        await result.current.retryLastMessage([], vi.fn());
      });

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });
  });

  describe("streaming", () => {
    it("should update streamingMessage during streaming", async () => {
      const chunks = [sseData("Hello"), sseData(" "), sseData("world")];
      let chunkIndex = 0;

      const mockStream = new ReadableStream({
        async pull(controller) {
          if (chunkIndex < chunks.length) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
            // Small delay to allow state updates
            await new Promise((r) => setTimeout(r, 10));
          } else {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useChat(projectId));

      await act(async () => {
        await result.current.sendMessage("Test", [], vi.fn());
      });

      // Final state should be cleared
      expect(result.current.streamingMessage).toBe("");
    });

    it("should handle incomplete JSON gracefully", async () => {
      // Send incomplete JSON that should be buffered
      const mockStream = createMockSSEStream([
        'data: {"choices":[{"delta":{',
        '"content":"Complete"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useChat(projectId));
      const onComplete = vi.fn();

      await act(async () => {
        await result.current.sendMessage("Test", [], onComplete);
      });

      expect(onComplete).toHaveBeenCalledWith("Complete");
    });
  });

  describe("context management", () => {
    it("should include existing messages in context", async () => {
      const mockStream = createMockSSEStream([
        sseData("Response"),
        "data: [DONE]\n\n",
      ]);

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const existingMessages = [
        {
          id: "1",
          project_id: projectId,
          role: "user" as const,
          content: "First message",
          sequence: 1,
          created_at: "2024-01-01",
          prompt_version: null,
          deleted_at: null,
        },
        {
          id: "2",
          project_id: projectId,
          role: "assistant" as const,
          content: "First response",
          sequence: 2,
          created_at: "2024-01-01",
          prompt_version: null,
          deleted_at: null,
        },
      ];

      const { result } = renderHook(() => useChat(projectId));

      await act(async () => {
        await result.current.sendMessage(
          "New message",
          existingMessages,
          vi.fn()
        );
      });

      // Check that fetch was called with messages including context
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("First message"),
        })
      );
    });

    it("should cap context at 98 messages", async () => {
      const mockStream = createMockSSEStream([
        sseData("Response"),
        "data: [DONE]\n\n",
      ]);

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      // Create 150 messages
      const manyMessages = Array.from({ length: 150 }, (_, i) => ({
        id: `msg-${i}`,
        project_id: projectId,
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `Message ${i}`,
        sequence: i + 1,
        created_at: "2024-01-01",
        prompt_version: null,
        deleted_at: null,
      }));

      const { result } = renderHook(() => useChat(projectId));

      await act(async () => {
        await result.current.sendMessage("New message", manyMessages, vi.fn());
      });

      // Parse the body to check message count
      const callArgs = mockAuthenticatedFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Should be 98 context + 1 new = 99 messages
      expect(body.messages.length).toBe(99);
    });
  });

  describe("isPendingMessage", () => {
    it("should track pending message IDs", async () => {
      let capturedIsLoading = false;

      const slowStream = new ReadableStream({
        async start(controller) {
          await new Promise((r) => setTimeout(r, 100));
          controller.enqueue(new TextEncoder().encode(sseData("Done")));
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        body: slowStream,
      });

      const { result } = renderHook(() => useChat(projectId));

      // Start sending
      const promise = act(async () => {
        result.current.sendMessage("Test", [], vi.fn());
      });

      // Check loading state
      await waitFor(() => {
        capturedIsLoading = result.current.isLoading;
      });

      expect(capturedIsLoading).toBe(true);

      await promise;
    });
  });
});
