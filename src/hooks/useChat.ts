/**
 * Chat hook for sending messages to the AI and handling streaming responses
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/database";
import { toast } from "sonner";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";
import { chatLogger } from "@/lib/logger";
import {
  CHAT_ENDPOINT,
  STREAM_TIMEOUT_MS,
  MAX_MESSAGE_LENGTH,
  calculateBackoffDelay,
  MAX_RETRY_ATTEMPTS,
} from "@/lib/constants";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatError = {
  type: "network" | "timeout" | "rate_limit" | "credits" | "server" | "stream_interrupted";
  message: string;
  canRetry: boolean;
};

interface PendingRetry {
  content: string;
  messages: Message[];
  onComplete: (response: string) => void;
  attempt: number;
}

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a UUID for client-side message tracking
 */
function generateMessageId(): string {
  return crypto.randomUUID();
}

/**
 * Hook for managing chat interactions with the AI
 * @param projectId - Current project ID
 */
export function useChat(projectId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [error, setError] = useState<ChatError | null>(null);
  const { authenticatedFetch } = useAuthenticatedFetch();
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string>("");
  const pendingMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingRetryRef = useRef<PendingRetry | null>(null);
  const autoRetryTimeoutRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (autoRetryTimeoutRef.current) {
        window.clearTimeout(autoRetryTimeoutRef.current);
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    pendingRetryRef.current = null;
    if (autoRetryTimeoutRef.current) {
      window.clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }
  }, []);

  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setStreamingMessage("");
    pendingRetryRef.current = null;
    if (autoRetryTimeoutRef.current) {
      window.clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Send a message to the AI and handle streaming response
   */
  const sendMessage = useCallback(
    async (
      content: string,
      existingMessages: Message[],
      onComplete: (response: string) => void,
      options?: { skipUserInsert?: boolean; retryAttempt?: number }
    ) => {
      if (!projectId) return;

      // Client-side validation
      const trimmedContent = content.trim();
      if (!trimmedContent || trimmedContent.length === 0) {
        toast.error("Message cannot be empty");
        return;
      }
      if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
        toast.error(`Message must be less than ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`);
        return;
      }

      // Cancel any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setStreamingMessage("");
      setError(null);
      lastMessageRef.current = trimmedContent;

      const retryAttempt = options?.retryAttempt ?? 0;

      // Generate client-side message ID for idempotency
      const userMessageId = generateMessageId();
      pendingMessageIdsRef.current.add(userMessageId);

      // Insert user message with client-generated ID (skip on auto-retry)
      if (!options?.skipUserInsert) {
        const { error: insertError } = await supabase.from("messages").insert({
          id: userMessageId,
          project_id: projectId,
          role: "user",
          content: trimmedContent,
        });

        if (insertError) {
          // Check if it's a duplicate (already exists) - that's OK
          if (insertError.code === "23505") {
            chatLogger.debug("Message already exists, continuing...");
          } else {
            chatLogger.error("Error sending message:", { error: insertError });
            toast.error("Failed to send message");
            setIsLoading(false);
            pendingMessageIdsRef.current.delete(userMessageId);
            return;
          }
        }
      }

      // Build messages array INCLUDING the new user message
      const chatMessages: ChatMessage[] = [
        ...existingMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: trimmedContent },
      ];

      const requestId = generateRequestId();
      chatLogger.debug(`Sending chat request`, { requestId, messageCount: chatMessages.length });

      try {
        const response = await authenticatedFetch(CHAT_ENDPOINT, {
          method: "POST",
          headers: { "X-Request-ID": requestId },
          body: JSON.stringify({ messages: chatMessages, project_id: projectId }),
          signal: abortControllerRef.current.signal,
        });

        if (!response) {
          setIsLoading(false);
          pendingMessageIdsRef.current.delete(userMessageId);
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          let chatError: ChatError;

          if (response.status === 429) {
            chatError = { type: "rate_limit", message: "Rate limit exceeded. Please wait a moment.", canRetry: true };
          } else if (response.status === 402) {
            chatError = { type: "credits", message: "Usage limit reached. Please add credits.", canRetry: false };
          } else if (response.status >= 500) {
            chatError = { type: "server", message: "Server error. Please try again.", canRetry: true };
          } else {
            chatError = { type: "server", message: errorData.error || "Failed to get AI response", canRetry: true };
          }

          setError(chatError);
          toast.error(chatError.message);
          setIsLoading(false);
          pendingMessageIdsRef.current.delete(userMessageId);
          return;
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let fullResponse = "";
        let lastDataTime = Date.now();

        while (true) {
          // Check for timeout
          if (Date.now() - lastDataTime > STREAM_TIMEOUT_MS) {
            reader.cancel();
            throw new Error("STREAM_TIMEOUT");
          }

          const { done, value } = await reader.read();
          if (done) break;

          lastDataTime = Date.now();
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const chunkContent = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (chunkContent) {
                fullResponse += chunkContent;
                setStreamingMessage(fullResponse);
              }
            } catch {
              // Incomplete JSON, put back and wait
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const chunkContent = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (chunkContent) {
                fullResponse += chunkContent;
                setStreamingMessage(fullResponse);
              }
            } catch {
              /* ignore */
            }
          }
        }

        // Save assistant message with client-generated ID for idempotency
        if (fullResponse) {
          const assistantMessageId = generateMessageId();
          pendingMessageIdsRef.current.add(assistantMessageId);

          const { error: assistantInsertError } = await supabase.from("messages").insert({
            id: assistantMessageId,
            project_id: projectId,
            role: "assistant",
            content: fullResponse,
          });

          if (assistantInsertError && assistantInsertError.code !== "23505") {
            chatLogger.error("Error saving assistant message:", { error: assistantInsertError });
          }

          pendingMessageIdsRef.current.delete(assistantMessageId);
          onComplete(fullResponse);
        }

        pendingMessageIdsRef.current.delete(userMessageId);
        setStreamingMessage("");
        setIsLoading(false);
      } catch (err) {
        pendingMessageIdsRef.current.delete(userMessageId);

        // Handle aborted requests silently
        if (err instanceof Error && err.name === "AbortError") {
          setIsLoading(false);
          setStreamingMessage("");
          return;
        }

        chatLogger.error("Chat error:", { error: err });

        let chatError: ChatError;
        let shouldAutoRetry = false;

        if (err instanceof Error) {
          if (err.message === "STREAM_TIMEOUT") {
            chatError = {
              type: "timeout",
              message: "Response timed out. The AI may be overloaded.",
              canRetry: true,
            };
          } else if (
            !navigator.onLine || 
            err.message === "Failed to fetch" || 
            err.message.includes("NetworkError") ||
            (err.name === "TypeError" && err.message.includes("fetch"))
          ) {
            // Network error - set up for auto-retry when connection restored
            chatError = {
              type: "network",
              message: navigator.onLine 
                ? "Unable to reach the server. Will retry automatically..." 
                : "You're offline. Will retry when connected...",
              canRetry: true,
            };
            shouldAutoRetry = true;
          } else {
            chatError = {
              type: "stream_interrupted",
              message: "Response was interrupted. Try again.",
              canRetry: true,
            };
          }
        } else {
          chatError = {
            type: "server",
            message: "Something went wrong. Please try again.",
            canRetry: true,
          };
        }

        setError(chatError);

        // Store pending retry for network errors (do NOT immediately loop-retry while online)
        if (shouldAutoRetry) {
          pendingRetryRef.current = {
            content: trimmedContent,
            messages: existingMessages,
            onComplete,
            attempt: retryAttempt,
          };
          toast.info(chatError.message);
        } else {
          toast.error(chatError.message);
        }

        setIsLoading(false);
        setStreamingMessage("");
      }
    },
    [projectId, authenticatedFetch]
  );

  /**
   * Retry the last message with exponential backoff
   */
  const retryLastMessage = useCallback(
    async (existingMessages: Message[], onComplete: (response: string) => void, attempt = 0) => {
      if (!lastMessageRef.current) return;

      if (attempt > 0 && attempt < MAX_RETRY_ATTEMPTS) {
        const delay = calculateBackoffDelay(attempt);
        chatLogger.debug(`Retry attempt ${attempt + 1}, waiting ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      await sendMessage(lastMessageRef.current, existingMessages, onComplete);
    },
    [sendMessage]
  );

  /**
   * Check if a message ID is pending (being processed)
   */
  const isPendingMessage = useCallback((messageId: string) => {
    return pendingMessageIdsRef.current.has(messageId);
  }, []);

  /**
   * Handle reconnection - retry pending message if any
   */
  const handleReconnect = useCallback(() => {
    if (pendingRetryRef.current && !isLoading) {
      const pending = pendingRetryRef.current;
      const nextAttempt = pending.attempt + 1;

      if (nextAttempt >= MAX_RETRY_ATTEMPTS) {
        chatLogger.debug("Max retry attempts reached, not auto-retrying");
        pendingRetryRef.current = null;
        return;
      }

      chatLogger.debug(`Connection restored, auto-retrying (attempt ${nextAttempt + 1})`);
      toast.info("Connection restored. Retrying...");

      pendingRetryRef.current = null;
      setError(null);

      const delay = calculateBackoffDelay(nextAttempt);
      autoRetryTimeoutRef.current = window.setTimeout(() => {
        sendMessage(pending.content, pending.messages, pending.onComplete, {
          skipUserInsert: true,
          retryAttempt: nextAttempt,
        });
      }, delay);
    }
  }, [isLoading, sendMessage]);

  /**
   * Check if there's a pending retry waiting for connection
   */
  const hasPendingRetry = pendingRetryRef.current !== null;

  return {
    sendMessage,
    isLoading,
    streamingMessage,
    error,
    clearError,
    cancelRequest,
    retryLastMessage,
    isPendingMessage,
    handleReconnect,
    hasPendingRetry,
  };
}
