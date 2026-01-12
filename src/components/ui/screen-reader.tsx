import { useEffect, useRef } from "react";

interface ScreenReaderAnnouncerProps {
  message: string;
  politeness?: "polite" | "assertive";
}

/**
 * Announces messages to screen readers using ARIA live regions.
 * Use "polite" for status updates, "assertive" for errors/important alerts.
 */
export function ScreenReaderAnnouncer({ 
  message, 
  politeness = "polite" 
}: ScreenReaderAnnouncerProps) {
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (announcerRef.current && message) {
      // Clear and re-set to ensure announcement
      announcerRef.current.textContent = "";
      requestAnimationFrame(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = message;
        }
      });
    }
  }, [message]);

  return (
    <div
      ref={announcerRef}
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    />
  );
}

/**
 * Visually hidden text for screen readers.
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
