import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMobileView } from "@/hooks/useMobileView";

interface ChatInputBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const SUBMIT_COOLDOWN_MS = 500;

export function ChatInputBar({ onSend, disabled, placeholder }: ChatInputBarProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isOnline = useOnlineStatus();
  const { isMobile } = useMobileView();

  const isDisabled = disabled || !isOnline;
  const isInCooldown = Date.now() - lastSubmitTime < SUBMIT_COOLDOWN_MS;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const now = Date.now();
    const trimmedInput = input.trim();
    
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
      return;
    }
    
    if (trimmedInput && !isDisabled) {
      setLastSubmitTime(now);
      onSend(trimmedInput);
      setInput("");
    }
  }, [input, isDisabled, lastSubmitTime, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-card px-6 py-4">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 mb-3 py-2 px-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm">You're offline. Reconnect to send messages.</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "bg-muted border border-border rounded-xl px-4 py-3 transition-all duration-200",
            !isOnline && "opacity-60",
            isFocused && isOnline && "ring-2 ring-primary/20 border-primary/50"
          )}
        >
          <div className="flex items-end gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={!isOnline ? "Waiting for connection..." : (placeholder || "Type your message...")}
              disabled={isDisabled}
              className={cn(
                "min-h-[44px] max-h-[200px] resize-none flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0",
                "text-base sm:text-sm text-foreground placeholder:text-muted-foreground",
                "touch-manipulation"
              )}
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isDisabled || !input.trim() || isInCooldown}
              aria-label={disabled ? "Sending message" : "Send message"}
              className={cn(
                "shrink-0 rounded-lg transition-transform active:scale-95 touch-manipulation bg-primary hover:bg-primary/90",
                isMobile ? "h-10 w-10" : "h-9 w-9"
              )}
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
              ) : (
                <Send className="h-4 w-4 text-primary-foreground" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
