/**
 * Realtime subscription utilities
 * Provides helpers for creating and managing Supabase realtime subscriptions
 */

import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { realtimeLogger } from "@/lib/logger";

/**
 * Supported realtime event types
 */
export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*";

/**
 * Configuration for a realtime subscription
 */
export interface RealtimeSubscriptionConfig<T> {
  /** Unique channel name (will be prefixed with table name) */
  channelId: string;
  /** Database table to subscribe to */
  table: string;
  /** Filter expression (e.g., "project_id=eq.uuid") */
  filter?: string;
  /** Event types to listen for (defaults to "*") */
  events?: RealtimeEventType;
  /** Callback when a matching event occurs */
  onEvent: (payload: T, eventType: RealtimeEventType) => void;
  /** Optional callback for status changes */
  onStatusChange?: (status: string) => void;
}

/**
 * Sanitize a string for use in a channel name
 * Removes special characters that could cause issues
 */
export function sanitizeChannelId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, "_");
}

/**
 * Create a realtime subscription for a database table
 * Returns a cleanup function to remove the subscription
 *
 * @example
 * ```ts
 * const cleanup = createRealtimeSubscription({
 *   channelId: projectId,
 *   table: "messages",
 *   filter: `project_id=eq.${projectId}`,
 *   events: "INSERT",
 *   onEvent: (message) => console.log("New message:", message),
 * });
 *
 * // Later, to clean up:
 * cleanup();
 * ```
 */
export function createRealtimeSubscription<T>(
  config: RealtimeSubscriptionConfig<T>
): () => void {
  const {
    channelId,
    table,
    filter,
    events = "*",
    onEvent,
    onStatusChange,
  } = config;

  const safeChannelId = sanitizeChannelId(channelId);
  const fullChannelName = `${table}-${safeChannelId}`;

  realtimeLogger.debug("Creating subscription", { channel: fullChannelName, table, filter });

  const channel = supabase
    .channel(fullChannelName)
    .on(
      "postgres_changes",
      {
        event: events,
        schema: "public",
        table,
        ...(filter && { filter }),
      },
      (payload) => {
        const eventType = payload.eventType as RealtimeEventType;
        // DELETE events have data in payload.old, INSERT/UPDATE use payload.new
        const data = (eventType === "DELETE" ? payload.old : payload.new) as T;
        realtimeLogger.debug("Event received", { channel: fullChannelName, eventType });
        onEvent(data, eventType);
      }
    )
    .subscribe((status) => {
      realtimeLogger.debug("Channel status", { channel: fullChannelName, status });
      onStatusChange?.(status);
    });

  // Return cleanup function
  return () => {
    realtimeLogger.debug("Removing subscription", { channel: fullChannelName });
    supabase.removeChannel(channel);
  };
}

/**
 * Create multiple realtime subscriptions at once
 * Returns a single cleanup function that removes all subscriptions
 *
 * @example
 * ```ts
 * const cleanup = createRealtimeSubscriptions([
 *   { channelId: projectId, table: "messages", onEvent: handleMessage },
 *   { channelId: projectId, table: "artifacts", onEvent: handleArtifact },
 * ]);
 *
 * // Later, to clean up all:
 * cleanup();
 * ```
 */
export function createRealtimeSubscriptions<T>(
  configs: RealtimeSubscriptionConfig<T>[]
): () => void {
  const cleanupFns = configs.map((config) => createRealtimeSubscription(config));

  return () => {
    cleanupFns.forEach((cleanup) => cleanup());
  };
}

/**
 * Helper to create a filter string for a single column equality check
 */
export function eqFilter(column: string, value: string): string {
  return `${column}=eq.${value}`;
}
