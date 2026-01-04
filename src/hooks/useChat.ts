import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/database";
import { toast } from "sonner";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatError = {
  type: "network" | "timeout" | "rate_limit" | "credits" | "server" | "stream_interrupted";
  message: string;
  canRetry: boolean;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const STREAM_TIMEOUT_MS = 30000; // 30s without data = timeout

export function useChat(projectId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [error, setError] = useState<ChatError | null>(null);
  const { authenticatedFetch } = useAuthenticatedFetch();
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string>("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setStreamingMessage("");
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      existingMessages: Message[],
      onComplete: (response: string) => void
    ) => {
      if (!projectId) return;

      // SECURITY: Client-side validation for defense-in-depth
      const trimmedContent = content.trim();
      if (!trimmedContent || trimmedContent.length === 0) {
        toast.error("Message cannot be empty");
        return;
      }
      if (trimmedContent.length > 50000) {
        toast.error("Message must be less than 50,000 characters");
        return;
      }

      // Cancel any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setStreamingMessage("");
      setError(null);
      lastMessageRef.current = trimmedContent;

      // Insert user message
      const { error: insertError } = await supabase.from("messages").insert({
        project_id: projectId,
        role: "user",
        content: trimmedContent,
      });

      if (insertError) {
        console.error("Error sending message:", insertError);
        toast.error("Failed to send message");
        setIsLoading(false);
        return;
      }

      // Prepare messages for AI
      const chatMessages: ChatMessage[] = existingMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      chatMessages.push({ role: "user", content: trimmedContent });

      try {
        const response = await authenticatedFetch(CHAT_URL, {
          method: "POST",
          body: JSON.stringify({ messages: chatMessages }),
          signal: abortControllerRef.current.signal,
        });

        if (!response) {
          setIsLoading(false);
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
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullResponse += content;
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
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullResponse += content;
                setStreamingMessage(fullResponse);
              }
            } catch {
              /* ignore */
            }
          }
        }

        // Save assistant message
        if (fullResponse) {
          await supabase.from("messages").insert({
            project_id: projectId,
            role: "assistant",
            content: fullResponse,
          });
          onComplete(fullResponse);
        }

        setStreamingMessage("");
        setIsLoading(false);
      } catch (err) {
        // Handle aborted requests silently
        if (err instanceof Error && err.name === "AbortError") {
          setIsLoading(false);
          setStreamingMessage("");
          return;
        }

        console.error("Chat error:", err);
        
        let chatError: ChatError;
        if (err instanceof Error) {
          if (err.message === "STREAM_TIMEOUT") {
            chatError = { 
              type: "timeout", 
              message: "Response timed out. The AI may be overloaded.", 
              canRetry: true 
            };
          } else if (err.message.includes("network") || err.message.includes("fetch")) {
            chatError = { 
              type: "network", 
              message: "Connection lost. Check your internet.", 
              canRetry: true 
            };
          } else {
            chatError = { 
              type: "stream_interrupted", 
              message: "Response was interrupted. Try again.", 
              canRetry: true 
            };
          }
        } else {
          chatError = { 
            type: "server", 
            message: "Something went wrong. Please try again.", 
            canRetry: true 
          };
        }

        setError(chatError);
        toast.error(chatError.message);
        setIsLoading(false);
        setStreamingMessage("");
      }
    },
    [projectId, authenticatedFetch]
  );

  const retryLastMessage = useCallback(
    async (existingMessages: Message[], onComplete: (response: string) => void) => {
      if (lastMessageRef.current) {
        await sendMessage(lastMessageRef.current, existingMessages, onComplete);
      }
    },
    [sendMessage]
  );

  return { 
    sendMessage, 
    isLoading, 
    streamingMessage, 
    error, 
    clearError, 
    cancelRequest,
    retryLastMessage 
  };
}
