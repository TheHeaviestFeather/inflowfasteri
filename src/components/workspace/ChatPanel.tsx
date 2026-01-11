import { useRef, useEffect, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { StarterPrompts } from "./StarterPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ParseErrorBanner } from "./ParseErrorBanner";
import { Message } from "@/types/database";
import { ChatError } from "@/hooks/useChat";
import { AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

interface ParseError {
  message: string;
  rawContent?: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  streamingMessage?: string;
  error?: ChatError | null;
  parseError?: ParseError | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onRetryParse?: () => void;
  onDismissParseError?: () => void;
  onClearHistory?: () => void;
}

export const ChatPanel = memo(function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  streamingMessage,
  error,
  parseError,
  onRetry,
  onDismissError,
  onRetryParse,
  onDismissParseError,
  onClearHistory,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Show thinking when loading but no streaming content yet
  const isThinking = isLoading && !streamingMessage;

  // Scroll to bottom when messages change or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, isThinking]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header with clear button */}
      {messages.length > 4 && onClearHistory && (
        <div className="flex justify-end px-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear old messages
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
          {messages.length === 0 && !streamingMessage && !isThinking ? (
            <StarterPrompts onSelectPrompt={onSendMessage} />
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <AnimatePresence mode="wait">
                {isThinking && <ThinkingIndicator key="thinking" />}
              </AnimatePresence>
              {streamingMessage && (
                <ChatMessage
                  message={{
                    id: "streaming",
                    project_id: "",
                    role: "assistant",
                    content: streamingMessage,
                    prompt_version: null,
                    sequence: 0,
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
              {/* Invisible element to scroll to */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>
      
      {/* Error Banners */}
      <ChatErrorBanner
        error={error ?? null}
        onRetry={onRetry}
        onDismiss={onDismissError}
        isRetrying={isLoading}
      />
      
      {parseError && (
        <ParseErrorBanner
          error={parseError.message}
          rawContent={parseError.rawContent}
          onRetry={onRetryParse ?? (() => {})}
          onDismiss={onDismissParseError ?? (() => {})}
        />
      )}
      
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder="Describe your training project or ask a question..."
      />
    </div>
  );
});
