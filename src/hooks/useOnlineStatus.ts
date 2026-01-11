import { useState, useEffect, useCallback, useRef } from "react";

interface UseOnlineStatusOptions {
  onReconnect?: () => void;
  debounceMs?: number;
}

export function useOnlineStatus(options: UseOnlineStatusOptions = {}) {
  const { onReconnect, debounceMs = 1000 } = options;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOfflineRef = useRef(false);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const handleOnline = useCallback(() => {
    // Clear any pending timeout
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }

    // Debounce the reconnect to avoid false positives
    reconnectTimeoutRef.current = window.setTimeout(() => {
      setIsOnline(true);
      
      // Only trigger reconnect callback if we were previously offline
      if (wasOfflineRef.current && onReconnect) {
        console.log("[useOnlineStatus] Connection restored, triggering reconnect callback");
        onReconnect();
      }
      wasOfflineRef.current = false;
    }, debounceMs);
  }, [onReconnect, debounceMs]);

  const handleOffline = useCallback(() => {
    // Clear any pending timeout
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsOnline(false);
    wasOfflineRef.current = true;
    console.log("[useOnlineStatus] Connection lost");
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}
