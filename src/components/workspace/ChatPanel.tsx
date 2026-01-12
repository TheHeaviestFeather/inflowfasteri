import { useRef, useEffect, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { StarterPrompts } from "./StarterPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ParseErrorBanner } from "./ParseErrorBanner";
import { ChatMessagesSkeleton } from "./ChatMessagesSkeleton";
import { Message } from "@/types/database";
import { ChatError } from "@/hooks/useChat";
import { AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useMobileView } from "@/hooks/useMobileView";
import { cn } from "@/lib/utils";

interface ParseError {
  message: string;
  rawContent?: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  messagesLoading?: boolean;
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
  messagesLoading,
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
  const { isMobile } = useMobileView();

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
        <div className={cn(
          "flex justify-end pt-2",
          isMobile ? "px-2" : "px-4"
        )}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="text-muted-foreground hover:text-destructive touch-manipulation"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className={cn(isMobile && "text-xs")}>Clear old messages</span>
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className={cn(
          "max-w-3xl mx-auto space-y-4 sm:space-y-6",
          isMobile ? "py-4 px-3" : "py-6 px-4"
        )}>
          {messagesLoading ? (
            <ChatMessagesSkeleton isMobile={isMobile} />
          ) : messages.length === 0 && !streamingMessage && !isThinking ? (
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
