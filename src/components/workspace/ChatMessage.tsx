import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { Message } from "@/types/database";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] px-4 py-3",
          isUser ? "chat-bubble-user" : "chat-bubble-assistant"
        )}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </p>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
          <User className="h-4 w-4 text-accent-foreground" />
        </div>
      )}
    </div>
  );
}
