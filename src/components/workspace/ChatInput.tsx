import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Loader2, ClipboardList, CheckCircle, Download, Play } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const COMMANDS = [
  { id: "status", label: "STATUS", icon: ClipboardList, description: "Check project progress" },
  { id: "continue", label: "CONTINUE", icon: Play, description: "Continue to next step" },
  { id: "approve", label: "APPROVE", icon: CheckCircle, description: "Approve current artifact" },
  { id: "export", label: "EXPORT", icon: Download, description: "Export deliverables" },
] as const;

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");
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
    <form onSubmit={handleSubmit} className="relative">
      {/* Command buttons */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        {COMMANDS.map((cmd) => (
          <Tooltip key={cmd.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCommand(cmd.label)}
                disabled={disabled}
                className="h-7 gap-1.5 text-xs font-medium"
              >
                <cmd.icon className="h-3.5 w-3.5" />
                {cmd.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{cmd.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-4 pb-4 pt-2 bg-card border-t-0">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your message..."}
          disabled={disabled}
          className="min-h-[48px] max-h-[200px] resize-none flex-1"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !input.trim()}
          className="h-12 w-12 shrink-0"
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </form>
  );
}
