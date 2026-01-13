import { useState, useEffect, useCallback, useRef } from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const RESIZE_DEBOUNCE_MS = 100;

export function useMobileView() {
  const [isMobile, setIsMobile] = useState(() => {
    // Safe initial state that works with SSR
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === "undefined") return false;
    const width = window.innerWidth;
    return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
  });

  useEffect(() => {
    let timeoutId: number | null = null;

    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < MOBILE_BREAKPOINT);
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
    };

    // Debounced resize handler to avoid excessive re-renders
    const handleResize = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(checkDevice, RESIZE_DEBOUNCE_MS);
    };

    // Initial check
    checkDevice();

    // Listen for resize with debouncing
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
}

// Swipe detection hook for mobile navigation
interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold = 50 }: SwipeHandlers) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    } else if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
