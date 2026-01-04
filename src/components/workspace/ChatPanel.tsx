import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { StarterPrompts } from "./StarterPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { Message } from "@/types/database";
import { AnimatePresence } from "framer-motion";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  streamingMessage?: string;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  streamingMessage,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show thinking when loading but no streaming content yet
  const isThinking = isLoading && !streamingMessage;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage, isThinking]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <ScrollArea className="flex-1" ref={scrollRef}>
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
            </>
          )}
        </div>
      </ScrollArea>
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder="Describe your training project or ask a question..."
      />
    </div>
  );
}
