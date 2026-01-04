import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/database";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function useChat(projectId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");

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

      setIsLoading(true);
      setStreamingMessage("");

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
        // Get the user's session token with automatic refresh
        let { data: { session } } = await supabase.auth.getSession();
        
        // If no session or token expired, try to refresh
        if (!session?.access_token) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            toast.error("Session expired. Please log in again.");
            setIsLoading(false);
            return;
          }
          session = refreshData.session;
        }

        const makeRequest = async (token: string) => {
          return fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ messages: chatMessages }),
          });
        };

        let response = await makeRequest(session.access_token);

        // If unauthorized, try refreshing the token once
        if (response.status === 401) {
          console.log("Token expired, attempting refresh...");
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshData.session) {
            toast.error("Session expired. Please log in again.");
            setIsLoading(false);
            return;
          }
          
          // Retry with new token
          response = await makeRequest(refreshData.session.access_token);
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 401) {
            toast.error("Session expired. Please log in again.");
          } else if (response.status === 429) {
            toast.error("Rate limit exceeded. Please wait a moment and try again.");
          } else if (response.status === 402) {
            toast.error("Usage limit reached. Please add credits to continue.");
          } else {
            toast.error(errorData.error || "Failed to get AI response");
          }
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

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
      } catch (error) {
        console.error("Chat error:", error);
        toast.error("Failed to get AI response");
        setIsLoading(false);
        setStreamingMessage("");
      }
    },
    [projectId]
  );

  return { sendMessage, isLoading, streamingMessage };
}
