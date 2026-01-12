import { cn } from "@/lib/utils";
import { MessageSquare, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface MobileViewTabsProps {
  activeView: "chat" | "deliverables";
  onViewChange: (view: "chat" | "deliverables") => void;
  hasNewDeliverable?: boolean;
  artifactCount?: number;
}

export function MobileViewTabs({ 
  activeView, 
  onViewChange, 
  hasNewDeliverable,
  artifactCount = 0,
}: MobileViewTabsProps) {
  return (
    <div className="flex border-b bg-card sticky top-0 z-20">
      <button
        onClick={() => onViewChange("chat")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-200 relative",
          "active:scale-[0.98] touch-manipulation",
          activeView === "chat"
            ? "text-primary border-b-2 border-primary bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        aria-selected={activeView === "chat"}
        role="tab"
      >
        {activeView === "deliverables" && (
          <ChevronLeft className="h-4 w-4 absolute left-4 text-muted-foreground" />
        )}
        <MessageSquare className="h-4 w-4" />
        <span>Chat</span>
      </button>
      
      <button
        onClick={() => onViewChange("deliverables")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-200 relative",
          "active:scale-[0.98] touch-manipulation",
          activeView === "deliverables"
            ? "text-primary border-b-2 border-primary bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        aria-selected={activeView === "deliverables"}
        role="tab"
      >
        <FileText className="h-4 w-4" />
        <span>Deliverables</span>
        {artifactCount > 0 && (
          <span className={cn(
            "ml-1 text-xs px-1.5 py-0.5 rounded-full",
            activeView === "deliverables" 
              ? "bg-primary/20 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {artifactCount}
          </span>
        )}
        {hasNewDeliverable && activeView !== "deliverables" && (
          <motion.span 
            className="absolute top-2 right-[calc(50%-50px)] w-2.5 h-2.5 bg-orange-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
        {activeView === "chat" && (
          <ChevronRight className="h-4 w-4 absolute right-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
