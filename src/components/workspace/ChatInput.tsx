import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Loader2, ClipboardList, CheckCircle, Download, Play } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCommand = (command: string) => {
    if (!disabled) {
      onSend(command);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative px-4 pb-4 pt-2">
      <div 
        className={cn(
          "rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-200",
          isFocused ? "ring-2 ring-primary/20 border-primary/40 shadow-lg" : "border-border shadow-sm"
        )}
      >
        {/* Input area */}
        <div className="flex items-end gap-2 p-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || "Type your message..."}
            disabled={disabled}
            className="min-h-[44px] max-h-[200px] resize-none flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-lg transition-transform hover:scale-105"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Streamlined command buttons */}
        <div className="flex items-center gap-1 px-3 pb-2 border-t border-border/50 pt-2">
          {COMMANDS.map((cmd) => (
            <Tooltip key={cmd.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCommand(cmd.label)}
                  disabled={disabled}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                >
                  <cmd.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>{cmd.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </form>
  );
}
