import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import { Message } from "@/types/database";
import { useMemo, memo, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { motion } from "framer-motion";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
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
 * Unescape a JSON string value
 */
function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    // Manual unescape as fallback
    return raw
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
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
  return unescapeJsonString(rawMessage);
}

/**
 * Regex-based fallback extraction for message field
 * Tries multiple patterns to find message content
 */
function extractMessageWithRegex(content: string): string | null {
  // Pattern 1: Standard JSON message field
  const pattern1 = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/;
  const match1 = content.match(pattern1);
  if (match1 && match1[1]) {
    return unescapeJsonString(match1[1]);
  }

  // Pattern 2: Message field that might be truncated (streaming)
  // Look for "message": " followed by content until we hit ", " or "} or end
  const pattern2 = /"message"\s*:\s*"((?:[^"\\]|\\.)*?)(?:"\s*[,}]|$)/;
  const match2 = content.match(pattern2);
  if (match2 && match2[1] && match2[1].length > 0) {
    return unescapeJsonString(match2[1]);
  }

  // Pattern 3: Look for message content between quotes after "message":
  const msgIndex = content.indexOf('"message"');
  if (msgIndex >= 0) {
    const afterMsg = content.substring(msgIndex + 9);
    const colonMatch = afterMsg.match(/^\s*:\s*"/);
    if (colonMatch) {
      const valueStart = colonMatch[0].length;
      const valueContent = afterMsg.substring(valueStart);
      // Find the end - either a proper closing quote or take what we have
      let endPos = 0;
      let escaped = false;
      for (let i = 0; i < valueContent.length; i++) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (valueContent[i] === '\\') {
          escaped = true;
          continue;
        }
        if (valueContent[i] === '"') {
          endPos = i;
          break;
        }
        endPos = i + 1; // Keep extending if no closing quote found
      }
      if (endPos > 0) {
        return unescapeJsonString(valueContent.substring(0, endPos));
      }
    }
  }

  return null;
}

/**
 * Attempt to repair common JSON issues and parse
 */
function tryRepairAndParse(content: string): string | null {
  let repaired = content;

  // Fix: Missing closing braces
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    // Check if we're in the middle of a string
    const lastQuote = repaired.lastIndexOf('"');
    const lastColon = repaired.lastIndexOf(':');
    if (lastColon > 0 && lastQuote > lastColon) {
      // Might be in a string value, try to close it
      const afterLastColon = repaired.substring(lastColon);
      const quoteCount = (afterLastColon.match(/"/g) || []).length;
      if (quoteCount % 2 === 1) {
        repaired += '"';
      }
    }
    repaired += '}'.repeat(openBraces - closeBraces);
  }

  // Fix: Trailing comma before closing brace
  repaired = repaired.replace(/,\s*}/g, '}');

  try {
    const parsed = JSON.parse(repaired);
    if (parsed.message && typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    // Repair didn't help
  }

  return null;
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
// Handles JSON-structured responses from V2 schema
function extractDisplayContent(content: string): string {
  // First sanitize the JSON string (handle code fences, prefixes, etc.)
  const sanitized = sanitizeJsonString(content);

  // If we have something that looks like JSON, try multiple extraction methods
  if (sanitized.startsWith("{") || content.includes('"message"')) {
    // Method 1: Try complete JSON parsing first
    try {
      const parsed = JSON.parse(sanitized);
      if (parsed.message && typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // Continue to fallback methods
    }

    // Method 2: Character-by-character extraction (handles streaming/incomplete JSON)
    const charExtracted = extractMessageFromJson(sanitized);
    if (charExtracted && charExtracted.length > 0) {
      return charExtracted;
    }

    // Method 3: Regex-based extraction (handles various malformed patterns)
    const regexExtracted = extractMessageWithRegex(sanitized);
    if (regexExtracted && regexExtracted.length > 0) {
      return regexExtracted;
    }

    // Method 4: Try on original content (in case sanitization removed too much)
    const originalCharExtracted = extractMessageFromJson(content);
    if (originalCharExtracted && originalCharExtracted.length > 0) {
      return originalCharExtracted;
    }

    const originalRegexExtracted = extractMessageWithRegex(content);
    if (originalRegexExtracted && originalRegexExtracted.length > 0) {
      return originalRegexExtracted;
    }

    // Method 5: Try JSON repair
    const repairedResult = tryRepairAndParse(sanitized);
    if (repairedResult && repairedResult.length > 0) {
      return repairedResult;
    }

    // If content has "message" but we couldn't extract it, return empty
    // to avoid showing raw JSON (better UX than showing code)
    if (sanitized.includes('"message"') || content.includes('"message"')) {
      // Last attempt: very short partial JSON during streaming
      if (sanitized.length < 30) {
        return ""; // Still streaming, wait for more content
      }
      return "";
    }
  }

  // Safety check: if content looks like code or raw JSON, don't display it
  if (looksLikeCode(content)) {
    return "";
  }

  // Additional safety: if content has too many curly braces, it's likely code/JSON
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces > 2 || closeBraces > 2) {
    return "";
  }

  // Legacy fallback for non-JSON responses
  let filtered = content;

  // Cut off STATE/json blocks during streaming
  const cutPoints = [
    filtered.search(/\nSTATE\b/i),
    filtered.search(/\n```json\b/i),
    filtered.search(/\n```\w+\b/i),  // Any code block
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
  filtered = filtered.replace(/```[\s\S]*?```/g, "");  // Remove any remaining code blocks
  filtered = filtered.replace(/\n{3,}/g, "\n\n").trim();

  // Final safety check on filtered content
  if (looksLikeCode(filtered) || filtered.length === 0) {
    return "";
  }

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
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md"
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </motion.div>
        )}
        <div
          className={cn(
            "max-w-[80%] px-4 py-4",
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
            <style>{`
              .chat-msg-prose .table-wrapper { display: block; width: 100%; overflow-x: auto; margin: 0.75rem 0; border-radius: 0.375rem; }
              .chat-msg-prose table { border-collapse: collapse; width: 100%; font-size: 0.75rem; }
              .chat-msg-prose thead { background-color: #f1f5f9; }
              .chat-msg-prose th { border: 1px solid #e2e8f0; padding: 0.375rem 0.5rem; text-align: left; font-weight: 600; }
              .chat-msg-prose td { border: 1px solid #e2e8f0; padding: 0.375rem 0.5rem; }
              .chat-msg-prose tr:nth-child(even) { background-color: #f8fafc; }
            `}</style>
            <div className="chat-msg-prose">
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
        </div>
        {isUser && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center"
            style={{ 
              boxShadow: '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary) / 0.3)' 
            }}
          >
            <User className="h-4 w-4 text-accent-foreground" />
          </motion.div>
        )}
      </motion.div>
    );
  }
));
