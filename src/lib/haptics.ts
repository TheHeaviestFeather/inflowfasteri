/**
 * Haptic feedback utility for mobile devices
 * Uses the Web Vibration API where supported
 */

type HapticPattern = "success" | "error" | "warning" | "light" | "medium" | "heavy";

// Vibration patterns in milliseconds
const PATTERNS: Record<HapticPattern, number | number[]> = {
  success: [10, 50, 10], // Double tap - satisfying confirmation
  error: [100, 50, 100, 50, 100], // Triple long buzz - attention
  warning: [50, 100, 50], // Medium pattern - caution
  light: 10, // Single short tap
  medium: 25, // Single medium tap
  heavy: 50, // Single strong tap
};

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/**
 * Trigger haptic feedback
 * @param pattern - The type of haptic feedback to trigger
 * @returns true if vibration was triggered, false otherwise
 */
export function triggerHaptic(pattern: HapticPattern = "light"): boolean {
  if (!isHapticSupported()) {
    return false;
  }

  try {
    const vibrationPattern = PATTERNS[pattern];
    return navigator.vibrate(vibrationPattern);
  } catch (error) {
    // Silently fail - haptics are non-critical
    console.debug("[Haptics] Vibration failed:", error);
    return false;
  }
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic(): void {
  if (isHapticSupported()) {
    navigator.vibrate(0);
  }
}

/**
 * Hook-friendly haptic functions
 */
export const haptics = {
  success: () => triggerHaptic("success"),
  error: () => triggerHaptic("error"),
  warning: () => triggerHaptic("warning"),
  light: () => triggerHaptic("light"),
  medium: () => triggerHaptic("medium"),
  heavy: () => triggerHaptic("heavy"),
  cancel: cancelHaptic,
  isSupported: isHapticSupported,
};
