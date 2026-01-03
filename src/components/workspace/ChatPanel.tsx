import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Message } from "@/types/database";
import { Sparkles } from "lucide-react";

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
          {messages.length === 0 && !streamingMessage ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Start your ID journey</h3>
              <p className="text-muted-foreground max-w-md">
                I'm here to guide you through the instructional design process. 
                Tell me about your training project and we'll work through it together.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
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
