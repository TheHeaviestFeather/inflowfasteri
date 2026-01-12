import { useRef, useEffect, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatBubble } from "./ChatBubble";
import { ChatInputBar } from "./ChatInputBar";
import { StarterPrompts } from "./StarterPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ParseErrorBanner } from "./ParseErrorBanner";
import { ChatMessagesSkeleton } from "./ChatMessagesSkeleton";
import { DateDivider } from "./DateDivider";
import { Message } from "@/types/database";
import { ChatError } from "@/hooks/useChat";
import { AnimatePresence } from "framer-motion";
import { Trash2, Coins } from "lucide-react";
import { useMobileView } from "@/hooks/useMobileView";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, isSameDay } from "date-fns";

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

// Helper to get date label
function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
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
  const { credits, isLow, isEmpty } = useCreditBalance();

  // Show thinking when loading but no streaming content yet
  const isThinking = isLoading && !streamingMessage;

  // Scroll to bottom when messages change or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, isThinking]);

  // Group messages by date for date dividers
  const renderMessagesWithDividers = () => {
    let lastDate: Date | null = null;
    const elements: React.ReactNode[] = [];

    messages.forEach((message, index) => {
      const messageDate = new Date(message.created_at);
      
      // Add date divider if this is a new day
      if (!lastDate || !isSameDay(lastDate, messageDate)) {
        elements.push(
          <DateDivider 
            key={`divider-${message.id}`} 
            label={getDateLabel(messageDate)} 
          />
        );
        lastDate = messageDate;
      }

      elements.push(
        <ChatBubble key={message.id} message={message} />
      );
    });

    return elements;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with clear button */}
      {messages.length > 4 && onClearHistory && (
        <div className={cn(
          "flex justify-end pt-2 border-b border-slate-100",
          isMobile ? "px-4" : "px-8"
        )}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            className="text-slate-500 hover:text-red-600 touch-manipulation mb-2"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className={cn(isMobile && "text-xs")}>Clear old messages</span>
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-8 py-6">
        <div className="max-w-3xl mx-auto">
          {messagesLoading ? (
            <ChatMessagesSkeleton isMobile={isMobile} />
          ) : messages.length === 0 && !streamingMessage && !isThinking ? (
            <StarterPrompts onSelectPrompt={onSendMessage} />
          ) : (
            <>
              {renderMessagesWithDividers()}
              <AnimatePresence mode="wait">
                {isThinking && <ThinkingIndicator key="thinking" />}
              </AnimatePresence>
              {/* Streaming message */}
              <div aria-live="polite" aria-atomic="false">
                {streamingMessage && (
                  <ChatBubble
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
              </div>
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
      
      {/* Credit Indicator */}
      <div className={cn(
        "flex items-center justify-end gap-1.5 text-xs border-t border-slate-100 py-1.5",
        isMobile ? "px-4" : "px-8"
      )}>
        <Coins className={cn(
          "h-3.5 w-3.5",
          isEmpty ? "text-red-500" : isLow ? "text-orange-500" : "text-muted-foreground"
        )} />
        <span className={cn(
          isEmpty ? "text-red-500 font-medium" : isLow ? "text-orange-500" : "text-muted-foreground"
        )}>
          {credits} credit{credits !== 1 ? "s" : ""} remaining
        </span>
      </div>

      {/* Input Bar */}
      <ChatInputBar
        onSend={onSendMessage}
        disabled={isLoading || isEmpty}
        placeholder={isEmpty ? "No credits remaining" : "Describe your training project or ask a question..."}/>
    </div>
  );
});
