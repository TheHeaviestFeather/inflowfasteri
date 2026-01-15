import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { useMemo, memo, forwardRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { motion } from "framer-motion";
import { Message } from "@/types/database";

interface ChatBubbleProps {
  message: Message;
  isStreaming?: boolean;
  children?: ReactNode;
}

/**
 * Sanitize and extract JSON from AI response
 * Handles various formats: raw JSON, code-fenced, with prefixes, etc.
 */
function sanitizeJsonString(raw: string): string {
  let cleaned = raw.trim();

  // Remove ```json ... ``` or ``` ... ``` wrappers
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // If starts with ``` (with or without json, possibly unclosed), strip it
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?[\s\n]*/, '').trim();
  }

  // If ends with ```, strip it
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/```$/, '').trim();
  }

  // Handle case where response starts with "json\n{" or "json{" (markdown artifact)
  if (cleaned.startsWith('json\n') || cleaned.startsWith('json{') || cleaned.startsWith('json ')) {
    cleaned = cleaned.replace(/^json[\s\n]*/, '').trim();
  }

  // If response doesn't start with {, try to find JSON object
  if (!cleaned.startsWith('{')) {
    // Check if it starts with "message" (missing opening brace)
    if (cleaned.startsWith('"message"') || cleaned.startsWith("'message'")) {
      cleaned = '{' + cleaned;
    } else {
      // Extract first JSON object from the string
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }
  }

  // Ensure response ends with }
  if (!cleaned.endsWith('}') && cleaned.includes('{')) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    }
  }

  return cleaned;
}

/**
 * Extract message from JSON using character-by-character parsing
 * Handles escape sequences properly for streaming/incomplete JSON
 */
function extractMessageFromJson(jsonStr: string): string | null {
  const messageKeyIndex = jsonStr.indexOf('"message"');
  if (messageKeyIndex < 0) return null;

  // Find the colon after "message"
  const colonIndex = jsonStr.indexOf(':', messageKeyIndex + 9);
  if (colonIndex < 0) return null;

  // Find the opening quote of the value
  const valueStartIndex = jsonStr.indexOf('"', colonIndex + 1);
  if (valueStartIndex < 0) return null;

  // Parse the string value character by character to handle escapes
  let endIndex = valueStartIndex + 1;
  let escaped = false;
  for (let i = valueStartIndex + 1; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      endIndex = i;
      break;
    }
  }

  if (endIndex <= valueStartIndex + 1) return null;

  const rawMessage = jsonStr.substring(valueStartIndex + 1, endIndex);

  // Unescape the JSON string
  try {
    return JSON.parse(`"${rawMessage}"`);
  } catch {
    // Manual unescape as fallback
    return rawMessage
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

/**
 * Detect if content looks like code or technical content that shouldn't be displayed
 */
function looksLikeCode(content: string): boolean {
  const codePatterns = [
    // JavaScript/TypeScript patterns
    /^\s*(function|const|let|var|class|import|export|interface|type)\s+/m,
    /^\s*(async\s+function|export\s+default|module\.exports)/m,
    /=>\s*\{/,  // Arrow functions
    /\bfunction\s*\([^)]*\)\s*\{/,  // Function declarations
    // JSON-like structures (but not natural prose)
    /^\s*\{[\s\n]*"[^"]+"\s*:/,  // JSON objects
    /^\s*\[[\s\n]*\{/,  // JSON arrays
    // Code block markers that weren't cleaned
    /^```\w+\s*$/m,
    // Common code constructs
    /\b(console\.log|return\s+\{|throw\s+new|try\s*\{|catch\s*\()/,
    // React/JSX patterns
    /<[A-Z][a-zA-Z]*[\s/>]/,  // JSX components
    /useState|useEffect|useCallback|useMemo/,
    // Import/require patterns
    /require\s*\(['"][^'"]+['"]\)/,
    /from\s+['"][^'"]+['"]/,
  ];

  return codePatterns.some(pattern => pattern.test(content));
}

// Extract readable message from AI responses
function extractDisplayContent(content: string): string {
  // First sanitize the JSON string (handle code fences, prefixes, etc.)
  const sanitized = sanitizeJsonString(content);

  // If we have something that looks like JSON, try to parse it
  if (sanitized.startsWith("{")) {
    // Try complete JSON parsing first
    try {
      const parsed = JSON.parse(sanitized);
      if (parsed.message && typeof parsed.message === "string") {
        return parsed.message;
      }
      // If parsed but no message field, return empty (don't show raw JSON)
      return "";
    } catch {
      // JSON parsing failed - try manual extraction for streaming/incomplete JSON
      const extracted = extractMessageFromJson(sanitized);
      if (extracted) {
        return extracted;
      }

      // If sanitized content is very short (partial JSON), return empty
      if (sanitized.length < 50) {
        return "";
      }

      // If we have JSON-like content but couldn't extract message, return empty
      // to avoid showing raw JSON to the user
      if (sanitized.includes('"message"') || sanitized.includes('"artifact"')) {
        return "";
      }
    }
  }

  // Check if original content contains JSON somewhere (might have been missed)
  if (content.includes('"message"') && content.includes('{')) {
    const extracted = extractMessageFromJson(content);
    if (extracted) {
      return extracted;
    }
    // Has JSON-like content but couldn't extract, return empty
    return "";
  }

  // Safety check: if content looks like code or raw JSON, don't display it
  // This prevents showing technical content when JSON parsing fails
  if (looksLikeCode(content)) {
    return "";
  }

  // Additional safety: if content has too many curly braces, it's likely code/JSON
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces > 2 || closeBraces > 2) {
    return "";
  }

  // Legacy fallback for non-JSON responses (plain text from older models)
  let filtered = content;

  const cutPoints = [
    filtered.search(/\nSTATE\b/i),
    filtered.search(/\n```json\b/i),
    filtered.search(/\n```\w+\b/i),  // Any code block
  ].filter((i) => i >= 0);

  if (cutPoints.length > 0) {
    filtered = filtered.slice(0, Math.min(...cutPoints));
  }

  filtered = filtered.replace(/STATE:?\s*```json[\s\S]*?```/gi, "");
  filtered = filtered.replace(/ARCHIVE:?\s*```json[\s\S]*?```/gi, "");
  filtered = filtered.replace(/STATE:?\s*\{[\s\S]*?"(?:mode|artifacts|pipeline_stage)"[\s\S]*?\}\s*/gi, "");
  filtered = filtered.replace(/ARCHIVE:?\s*\{[\s\S]*?\}\s*(?=\n\n|$)/gi, "");
  filtered = filtered.replace(/\nCommands:\s*(?:STATUS|APPROVE|EXPORT|CONTINUE|REVISE|SET MODE[^\n]*|\s*\|)+\s*$/gi, "");
  filtered = filtered.replace(/```[\s\S]*?```/g, "");  // Remove any remaining code blocks
  filtered = filtered.replace(/\n{3,}/g, "\n\n").trim();

  // Final safety check on filtered content
  if (looksLikeCode(filtered) || filtered.length === 0) {
    return "";
  }

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
          <div 
            className="text-sm prose prose-sm max-w-none dark:prose-invert
              prose-headings:font-semibold prose-headings:leading-snug
              prose-h2:text-lg prose-h3:text-base prose-h4:text-sm
              prose-hr:my-4 prose-hr:border-border
              prose-ul:pl-5 prose-ol:pl-5 prose-ul:list-disc prose-ol:list-decimal
              prose-strong:font-semibold prose-strong:text-foreground
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            style={{
              lineHeight: '1.5rem',
            }}
          >
            <style>{`
              .chat-prose p { margin-top: 0.75rem; margin-bottom: 0.75rem; line-height: 1.5rem; }
              .chat-prose ul, .chat-prose ol { margin-top: 0.75rem; margin-bottom: 0.75rem; }
              .chat-prose li { margin-top: 0.25rem; margin-bottom: 0.25rem; line-height: 1.5rem; }
              .chat-prose h2, .chat-prose h3, .chat-prose h4 { margin-top: 0.75rem; margin-bottom: 0.75rem; }
              .chat-prose .table-wrapper { display: block; width: 100%; overflow-x: auto; margin: 0.75rem 0; border-radius: 0.375rem; }
              .chat-prose table { border-collapse: collapse; width: 100%; font-size: 0.75rem; }
              .chat-prose thead { background-color: #f1f5f9; }
              .chat-prose th { border: 1px solid #e2e8f0; padding: 0.375rem 0.5rem; text-align: left; font-weight: 600; }
              .chat-prose td { border: 1px solid #e2e8f0; padding: 0.375rem 0.5rem; }
              .chat-prose tr:nth-child(even) { background-color: #f8fafc; }
            `}</style>
            <div className="chat-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  table: ({ children }) => (
                    <div className="table-wrapper">
                      <table>{children}</table>
                    </div>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
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
