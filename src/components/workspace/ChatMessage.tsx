import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { Message } from "@/types/database";
import { useMemo, memo, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { motion } from "framer-motion";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

// Extract readable message from AI responses
// Handles JSON-structured responses from V2 schema
function extractDisplayContent(content: string): string {
  let trimmed = content.trim();
  
  // Strip markdown code fences if present (AI sometimes wraps JSON in ```json ... ```)
  if (trimmed.startsWith("```json")) {
    trimmed = trimmed.slice(7); // Remove ```json
  } else if (trimmed.startsWith("```")) {
    trimmed = trimmed.slice(3); // Remove ```
  }
  
  // Remove trailing code fence
  if (trimmed.endsWith("```")) {
    trimmed = trimmed.slice(0, -3);
  }
  
  trimmed = trimmed.trim();
  
  // Try to parse as complete JSON first (structured AI response)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.message && typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // Incomplete JSON during streaming - try to extract message field
      const messageMatch = trimmed.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (messageMatch) {
        try {
          // Unescape the JSON string
          return JSON.parse(`"${messageMatch[1]}"`);
        } catch {
          // Simple unescape for common cases
          return messageMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        }
      }
      
      // If still streaming JSON, show a placeholder
      if (trimmed.length < 50) {
        return "";
      }
    }
  }

  // Legacy fallback for non-JSON responses
  let filtered = content;

  // Cut off STATE/json blocks during streaming
  const cutPoints = [
    filtered.search(/\nSTATE\b/i),
    filtered.search(/\n```json\b/i),
  ].filter((i) => i >= 0);

  if (cutPoints.length > 0) {
    filtered = filtered.slice(0, Math.min(...cutPoints));
  }

  // Remove various JSON/metadata blocks
  filtered = filtered.replace(/STATE:?\s*```json[\s\S]*?```/gi, "");
  filtered = filtered.replace(/ARCHIVE:?\s*```json[\s\S]*?```/gi, "");
  filtered = filtered.replace(/STATE:?\s*\{[\s\S]*?"(?:mode|artifacts|pipeline_stage)"[\s\S]*?\}\s*/gi, "");
  filtered = filtered.replace(/ARCHIVE:?\s*\{[\s\S]*?\}\s*(?=\n\n|$)/gi, "");
  filtered = filtered.replace(/\nCommands:\s*(?:STATUS|APPROVE|EXPORT|CONTINUE|REVISE|SET MODE[^\n]*|\s*\|)+\s*$/gi, "");
  filtered = filtered.replace(/\n{3,}/g, "\n\n").trim();

  return filtered;
}

export const ChatMessage = memo(forwardRef<HTMLDivElement, ChatMessageProps>(
  function ChatMessage({ message, isStreaming }, ref) {
    const isUser = message.role === "user";
    
    const displayContent = useMemo(() => {
      if (isUser) return message.content;
      return extractDisplayContent(message.content);
    }, [message.content, isUser]);

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(
          "flex gap-3",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {!isUser && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center shadow-md"
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </motion.div>
        )}
        <div
          className={cn(
            "max-w-[80%] px-4 py-3 shadow-sm",
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
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
              {displayContent}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse rounded-sm" />
            )}
          </div>
        </div>
        {isUser && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-md"
          >
            <User className="h-4 w-4 text-accent-foreground" />
          </motion.div>
        )}
      </motion.div>
    );
  }
));
