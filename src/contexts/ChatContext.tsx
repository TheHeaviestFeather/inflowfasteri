/**
 * ChatContext - Chat/messaging state management
 *
 * Manages message state, streaming, and chat operations.
 * Components that only need chat functionality subscribe here.
 */

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useChat, ChatError } from "@/hooks/useChat";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
import { Message } from "@/types/database";

export interface ChatState {
  messages: Message[];
  messagesLoading: boolean;
  streamingMessage: string;
  isLoading: boolean;
  error: ChatError | null;
}

export interface ChatActions {
  sendMessage: (content: string) => Promise<string | null>;
  retryLastMessage: () => void;
  clearError: () => void;
}

export interface ChatContextValue {
  state: ChatState;
  actions: ChatActions;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: React.ReactNode;
  projectId: string | null;
  messages: Message[];
  messagesLoading: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onArtifactChange: (artifact: unknown, eventType: "INSERT" | "UPDATE") => void;
}

export function ChatProvider({
  children,
  projectId,
  messages,
  messagesLoading,
  setMessages,
  onArtifactChange,
}: ChatProviderProps) {
  const {
    sendMessage,
    isLoading,
    streamingMessage,
    error,
    clearError,
    retryLastMessage,
    handleReconnect,
  } = useChat(projectId);

  // Online status with auto-retry on reconnect
  useOnlineStatus({ onReconnect: handleReconnect });

  // Realtime message handler
  const handleNewMessage = useCallback(
    (newMessage: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    },
    [setMessages]
  );

  // Set up realtime subscriptions
  useWorkspaceRealtime({
    projectId,
    onNewMessage: handleNewMessage,
    onArtifactChange,
  });

  const state: ChatState = useMemo(
    () => ({
      messages,
      messagesLoading,
      streamingMessage,
      isLoading,
      error,
    }),
    [messages, messagesLoading, streamingMessage, isLoading, error]
  );

  const actions: ChatActions = useMemo(
    () => ({
      sendMessage,
      retryLastMessage,
      clearError,
    }),
    [sendMessage, retryLastMessage, clearError]
  );

  const contextValue = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}

export function useChatState(): ChatState {
  return useChatContext().state;
}

export function useChatActions(): ChatActions {
  return useChatContext().actions;
}
