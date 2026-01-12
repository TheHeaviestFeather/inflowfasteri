import { cn } from "@/lib/utils";
import { MessageSquare, FileText } from "lucide-react";

interface MobileViewTabsProps {
  activeView: "chat" | "deliverables";
  onViewChange: (view: "chat" | "deliverables") => void;
  hasNewDeliverable?: boolean;
}

export function MobileViewTabs({ activeView, onViewChange, hasNewDeliverable }: MobileViewTabsProps) {
  return (
    <div className="flex border-b bg-card">
      <button
        onClick={() => onViewChange("chat")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
          activeView === "chat"
            ? "text-primary border-b-2 border-primary bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </button>
      <button
        onClick={() => onViewChange("deliverables")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
          activeView === "deliverables"
            ? "text-primary border-b-2 border-primary bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <FileText className="h-4 w-4" />
        Deliverables
        {hasNewDeliverable && activeView !== "deliverables" && (
          <span className="absolute top-2 right-[calc(50%-40px)] w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
}
