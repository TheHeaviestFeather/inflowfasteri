import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { Message } from "@/types/database";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

// Filter out JSON blocks and everything after "Commands:" line from displayed content
function filterJsonBlocks(content: string): string {
  let filtered = content;
  
  // Remove everything after "Commands: STATUS | EXPORT | CONTINUE" (or similar variations)
  filtered = filtered.replace(/Commands:\s*(?:STATUS|APPROVE|EXPORT|CONTINUE|\s*\|)+[\s\S]*/gi, "");
  
  // Remove STATE: ```json ... ``` blocks
  filtered = filtered.replace(/STATE:\s*```json[\s\S]*?```/gi, "");
  
  // Remove ARCHIVE: ```json ... ``` blocks  
  filtered = filtered.replace(/ARCHIVE:\s*```json[\s\S]*?```/gi, "");
  
  // Remove any remaining ```json ... ``` blocks
  filtered = filtered.replace(/```json[\s\S]*?```/gi, "");
  
  // Remove standalone STATE: {...} blocks (inline JSON)
  filtered = filtered.replace(/STATE:\s*\{[\s\S]*?\}\s*(?=\n\n|$)/gi, "");
  
  // Remove standalone ARCHIVE: {...} blocks (inline JSON)
  filtered = filtered.replace(/ARCHIVE:\s*\{[\s\S]*?\}\s*(?=\n\n|$)/gi, "");
  
  // Clean up extra whitespace
  filtered = filtered.replace(/\n{3,}/g, "\n\n").trim();
  
  return filtered;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  
  const displayContent = useMemo(() => {
    if (isUser) return message.content;
    return filterJsonBlocks(message.content);
  }, [message.content, isUser]);

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
        <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert 
          prose-p:my-3 prose-p:leading-relaxed
          prose-ul:my-3 prose-ol:my-3 
          prose-li:my-1.5 prose-li:leading-relaxed
          prose-headings:my-4 prose-headings:font-semibold prose-headings:leading-tight
          prose-h2:text-lg prose-h3:text-base prose-h4:text-sm
          prose-hr:my-6 prose-hr:border-border
          prose-ul:pl-5 prose-ol:pl-5 prose-ul:list-disc prose-ol:list-decimal
          [&_ul_ul]:mt-2 [&_ul_ul]:mb-1 [&_ol_ul]:mt-2 [&_ol_ul]:mb-1
          [&_li>ul]:pl-4 [&_li>ol]:pl-4
          prose-strong:font-semibold prose-strong:text-foreground
          [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <ReactMarkdown>
            {displayContent}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
          <User className="h-4 w-4 text-accent-foreground" />
        </div>
      )}
    </div>
  );
}
