import { useCallback, useRef } from "react";

/**
 * Creates a debounced version of a callback function.
 * The callback will only be executed after the specified delay has passed
 * since the last invocation.
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns A debounced version of the callback
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  callbackRef.current = callback;

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = window.setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedCallback;
}

/**
 * Creates a throttled version of a callback function.
 * The callback will be executed at most once per specified interval.
 * 
 * @param callback - The function to throttle
 * @param delay - Minimum time between executions in milliseconds
 * @returns A throttled version of the callback
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const lastRunRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  callbackRef.current = callback;

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastRunRef.current >= delay) {
        lastRunRef.current = now;
        callbackRef.current(...args);
      }
    },
    [delay]
  ) as T;

  return throttledCallback;
}

/**
 * Prevents rapid submissions (double-click protection).
 * Returns a wrapped callback that ignores calls within the cooldown period.
 * 
 * @param callback - The function to protect
 * @param cooldownMs - Cooldown period in milliseconds (default: 500ms)
 * @returns A protected version of the callback
 */
export function useSubmitProtection<T extends (...args: unknown[]) => void>(
  callback: T,
  cooldownMs: number = 500
): { submit: T; isInCooldown: boolean } {
  const lastSubmitRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  callbackRef.current = callback;

  const submit = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastSubmitRef.current >= cooldownMs) {
        lastSubmitRef.current = now;
        callbackRef.current(...args);
      }
    },
    [cooldownMs]
  ) as T;

  const isInCooldown = Date.now() - lastSubmitRef.current < cooldownMs;

  return { submit, isInCooldown };
}
