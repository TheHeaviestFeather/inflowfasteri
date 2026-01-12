import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { useMemo, memo, forwardRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { motion } from "framer-motion";
import { Message } from "@/types/database";

interface ChatBubbleProps {
  message: Message;
  isStreaming?: boolean;
  children?: ReactNode;
}

// Extract readable message from AI responses
function extractDisplayContent(content: string): string {
  let trimmed = content.trim();
  
  // Strip markdown code fences if present
  if (trimmed.startsWith("```json")) {
    trimmed = trimmed.slice(7);
  } else if (trimmed.startsWith("```")) {
    trimmed = trimmed.slice(3);
  }
  
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
      const messageMatch = trimmed.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (messageMatch) {
        try {
          return JSON.parse(`"${messageMatch[1]}"`);
        } catch {
          return messageMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        }
      }
      
      if (trimmed.length < 50) {
        return "";
      }
    }
  }

  // Legacy fallback for non-JSON responses
  let filtered = content;

  const cutPoints = [
    filtered.search(/\nSTATE\b/i),
    filtered.search(/\n```json\b/i),
  ].filter((i) => i >= 0);

  if (cutPoints.length > 0) {
    filtered = filtered.slice(0, Math.min(...cutPoints));
  }

  filtered = filtered.replace(/STATE:?\s*```json[\s\S]*?```/gi, "");
  filtered = filtered.replace(/ARCHIVE:?\s*```json[\s\S]*?```/gi, "");
  filtered = filtered.replace(/STATE:?\s*\{[\s\S]*?"(?:mode|artifacts|pipeline_stage)"[\s\S]*?\}\s*/gi, "");
  filtered = filtered.replace(/ARCHIVE:?\s*\{[\s\S]*?\}\s*(?=\n\n|$)/gi, "");
  filtered = filtered.replace(/\nCommands:\s*(?:STATUS|APPROVE|EXPORT|CONTINUE|REVISE|SET MODE[^\n]*|\s*\|)+\s*$/gi, "");
  filtered = filtered.replace(/\n{3,}/g, "\n\n").trim();

  return filtered;
}

export const ChatBubble = memo(forwardRef<HTMLDivElement, ChatBubbleProps>(
  function ChatBubble({ message, isStreaming, children }, ref) {
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
          "flex gap-3 mb-6",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {/* AI Avatar */}
        {!isUser && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-dark-500 flex items-center justify-center shadow-md"
            style={{ backgroundColor: '#21334f' }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </motion.div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            "max-w-[80%] px-4 py-4",
            isUser 
              ? "rounded-2xl rounded-tr-sm text-white" 
              : "bg-slate-100 text-slate-900 rounded-2xl rounded-tl-sm"
          )}
          style={isUser ? { backgroundColor: '#21334f' } : undefined}
        >
          <div className="text-sm prose prose-sm max-w-none dark:prose-invert
            prose-p:my-2.5 prose-p:leading-[1.7]
            prose-ul:my-2.5 prose-ol:my-2.5 
            prose-li:my-1 prose-li:leading-[1.7]
            prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug
            prose-h2:text-lg prose-h3:text-base prose-h4:text-sm
            prose-hr:my-4 prose-hr:border-border
            prose-ul:pl-5 prose-ol:pl-5 prose-ul:list-disc prose-ol:list-decimal
            [&_ul_ul]:mt-1.5 [&_ul_ul]:mb-0.5 [&_ol_ul]:mt-1.5 [&_ol_ul]:mb-0.5
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
          
          {/* Render children (e.g., NotificationCard) inside the bubble */}
          {children}
        </div>

        {/* User Avatar */}
        {isUser && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ 
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 0 2px white, 0 0 0 4px rgba(245, 158, 11, 0.3)' 
            }}
          >
            <User className="h-4 w-4 text-white" />
          </motion.div>
        )}
      </motion.div>
    );
  }
));
