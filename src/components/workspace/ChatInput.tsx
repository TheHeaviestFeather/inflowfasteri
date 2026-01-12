import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Loader2, ClipboardList, CheckCircle, Download, Play, WifiOff, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMobileView } from "@/hooks/useMobileView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const COMMANDS = [
  { id: "status", label: "STATUS", icon: ClipboardList, description: "Check progress" },
  { id: "continue", label: "CONTINUE", icon: Play, description: "Next step" },
  { id: "approve", label: "APPROVE", icon: CheckCircle, description: "Approve" },
  { id: "export", label: "EXPORT", icon: Download, description: "Export" },
] as const;

// Minimum time between submissions (prevents double-click)
const SUBMIT_COOLDOWN_MS = 500;

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
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
    
    // Prevent rapid submissions
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

  const handleCommand = useCallback((command: string) => {
    const now = Date.now();
    
    // Prevent rapid command submissions
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
      return;
    }
    
    if (!isDisabled) {
      setLastSubmitTime(now);
      onSend(command);
    }
  }, [isDisabled, lastSubmitTime, onSend]);

  // Mobile command menu
  const MobileCommandMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDisabled}
          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground touch-manipulation"
          aria-label="Open commands menu"
        >
          <Command className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-popover">
        {COMMANDS.map((cmd) => (
          <DropdownMenuItem
            key={cmd.id}
            onClick={() => handleCommand(cmd.label)}
            disabled={isDisabled}
            className="gap-2 py-3 touch-manipulation"
          >
            <cmd.icon className="h-4 w-4" />
            <span>{cmd.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <form onSubmit={handleSubmit} className="relative px-3 sm:px-4 pb-4 pt-2">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 mb-2 py-2 px-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm animate-fade-in">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm">You're offline. Reconnect to send messages.</span>
        </div>
      )}

      <div 
        className={cn(
          "rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-200",
          !isOnline && "opacity-60",
          isFocused && isOnline ? "ring-2 ring-primary/20 border-primary/40 shadow-lg" : "border-border shadow-sm"
        )}
      >
        {/* Input area */}
        <div className="flex items-end gap-2 p-2 sm:p-3">
          {/* Mobile command button */}
          {isMobile && <MobileCommandMenu />}
          
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
              "text-base sm:text-sm", // Larger text on mobile to prevent zoom
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
              "shrink-0 rounded-lg transition-transform active:scale-95 touch-manipulation",
              isMobile ? "h-10 w-10" : "h-9 w-9"
            )}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Desktop command buttons */}
        {!isMobile && (
          <div className="flex items-center gap-1 px-3 pb-2 border-t border-border/50 pt-2">
            {COMMANDS.map((cmd) => (
              <Tooltip key={cmd.id}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCommand(cmd.label)}
                    disabled={isDisabled}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    aria-label={cmd.description}
                  >
                    <cmd.icon className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{cmd.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
