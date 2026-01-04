/**
 * Unit tests for ChatPanel component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";
import { Message } from "@/types/database";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

// Mock child components to isolate ChatPanel testing
vi.mock("./ChatMessage", () => ({
  ChatMessage: ({ message, isStreaming }: { message: Message; isStreaming?: boolean }) => (
    <div data-testid={`message-${message.id}`} data-streaming={isStreaming}>
      <span data-testid="message-role">{message.role}</span>
      <span data-testid="message-content">{message.content}</span>
    </div>
  ),
}));

vi.mock("./ChatInput", () => ({
  ChatInput: ({ onSend, disabled }: { onSend: (content: string) => void; disabled?: boolean }) => (
    <div data-testid="chat-input">
      <input
        data-testid="input-field"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value) {
            onSend(e.currentTarget.value);
          }
        }}
      />
    </div>
  ),
}));

vi.mock("./StarterPrompts", () => ({
  StarterPrompts: ({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) => (
    <div data-testid="starter-prompts">
      <button onClick={() => onSelectPrompt("Test prompt")}>Select Prompt</button>
    </div>
  ),
}));

vi.mock("./ThinkingIndicator", () => ({
  ThinkingIndicator: () => <div data-testid="thinking-indicator">Thinking...</div>,
}));

vi.mock("./ChatErrorBanner", () => ({
  ChatErrorBanner: ({ error, onRetry }: { error: unknown; onRetry?: () => void }) =>
    error ? (
      <div data-testid="error-banner">
        <button onClick={onRetry}>Retry</button>
      </div>
    ) : null,
}));

const createMockMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "msg-1",
  project_id: "proj-1",
  role: "user",
  content: "Test message",
  prompt_version: null,
  sequence: 1,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("ChatPanel", () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Empty state", () => {
    it("shows starter prompts when no messages exist", () => {
      render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />);

      expect(screen.getByTestId("starter-prompts")).toBeInTheDocument();
    });

    it("calls onSendMessage when starter prompt is selected", () => {
      render(<ChatPanel messages={[]} onSendMessage={mockOnSendMessage} />);

      fireEvent.click(screen.getByText("Select Prompt"));

      expect(mockOnSendMessage).toHaveBeenCalledWith("Test prompt");
    });
  });

  describe("Messages display", () => {
    it("renders all messages", () => {
      const messages = [
        createMockMessage({ id: "msg-1", role: "user", content: "Hello" }),
        createMockMessage({ id: "msg-2", role: "assistant", content: "Hi there" }),
      ];

      render(<ChatPanel messages={messages} onSendMessage={mockOnSendMessage} />);

      expect(screen.getByTestId("message-msg-1")).toBeInTheDocument();
      expect(screen.getByTestId("message-msg-2")).toBeInTheDocument();
    });

    it("hides starter prompts when messages exist", () => {
      const messages = [createMockMessage()];

      render(<ChatPanel messages={messages} onSendMessage={mockOnSendMessage} />);

      expect(screen.queryByTestId("starter-prompts")).not.toBeInTheDocument();
    });
  });

  describe("Loading states", () => {
    it("shows thinking indicator when loading without streaming content", () => {
      render(
        <ChatPanel
          messages={[createMockMessage()]}
          onSendMessage={mockOnSendMessage}
          isLoading={true}
        />
      );

      expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
    });

    it("hides thinking indicator when streaming content is present", () => {
      render(
        <ChatPanel
          messages={[createMockMessage()]}
          onSendMessage={mockOnSendMessage}
          isLoading={true}
          streamingMessage="Streaming response..."
        />
      );

      expect(screen.queryByTestId("thinking-indicator")).not.toBeInTheDocument();
    });

    it("disables input when loading", () => {
      render(
        <ChatPanel
          messages={[createMockMessage()]}
          onSendMessage={mockOnSendMessage}
          isLoading={true}
        />
      );

      expect(screen.getByTestId("input-field")).toBeDisabled();
    });
  });

  describe("Streaming", () => {
    it("renders streaming message with isStreaming flag", () => {
      render(
        <ChatPanel
          messages={[createMockMessage()]}
          onSendMessage={mockOnSendMessage}
          streamingMessage="Partial response..."
        />
      );

      const streamingMessage = screen.getByTestId("message-streaming");
      expect(streamingMessage).toBeInTheDocument();
      expect(streamingMessage).toHaveAttribute("data-streaming", "true");
    });
  });

  describe("Error handling", () => {
    it("shows error banner when error is present", () => {
      const error = { type: "network" as const, message: "Connection lost", canRetry: true };

      render(
        <ChatPanel
          messages={[createMockMessage()]}
          onSendMessage={mockOnSendMessage}
          error={error}
        />
      );

      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    it("calls onRetry when retry button is clicked", () => {
      const mockOnRetry = vi.fn();
      const error = { type: "network" as const, message: "Connection lost", canRetry: true };

      render(
        <ChatPanel
          messages={[createMockMessage()]}
          onSendMessage={mockOnSendMessage}
          error={error}
          onRetry={mockOnRetry}
        />
      );

      fireEvent.click(screen.getByText("Retry"));
      expect(mockOnRetry).toHaveBeenCalled();
    });
  });
});
