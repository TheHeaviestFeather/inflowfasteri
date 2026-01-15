/**
 * AuthContext - Authentication state management
 *
 * Provides user authentication state and actions.
 * Components that only need auth state subscribe here to avoid re-renders
 * from unrelated workspace changes.
 */

import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export interface AuthState {
  user: { id: string; email?: string } | null;
  isAuthLoading: boolean;
}

export interface AuthActions {
  signOut: () => void;
}

export interface AuthContextValue {
  state: AuthState;
  actions: AuthActions;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();

  const state: AuthState = useMemo(
    () => ({
      user: user ? { id: user.id, email: user.email } : null,
      isAuthLoading: authLoading,
    }),
    [user, authLoading]
  );

  const actions: AuthActions = useMemo(
    () => ({
      signOut,
    }),
    [signOut]
  );

  const contextValue = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

export function useAuthState(): AuthState {
  return useAuthContext().state;
}

export function useAuthActions(): AuthActions {
  return useAuthContext().actions;
}
