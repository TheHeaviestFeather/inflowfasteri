import { Button } from "@/components/ui/button";
import { ARTIFACT_LABELS } from "@/types/database";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeliverableBanner } from "./types";

interface ArtifactNotificationBannerProps {
  banner: DeliverableBanner;
  onDismiss: () => void;
}

export function ArtifactNotificationBanner({ banner, onDismiss }: ArtifactNotificationBannerProps) {
  return (
    <div className={cn(
      "px-4 py-2 flex items-center gap-2 border-b animate-in slide-in-from-top-2 duration-200",
      banner.isStale
        ? "bg-gradient-to-r from-destructive/10 to-warning/10 border-destructive/30"
        : "bg-gradient-to-r from-warning/10 to-accent/10 border-warning/30"
    )}>
      {banner.isStale ? (
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 animate-pulse" />
      ) : (
        <Sparkles className="h-4 w-4 text-warning flex-shrink-0" />
      )}
      <p className={cn(
        "text-sm flex-1 truncate",
        banner.isStale ? "text-destructive" : "text-warning"
      )}>
        <span className="font-medium">{ARTIFACT_LABELS[banner.type]}</span>
        {banner.isStale
          ? " needs review — a dependency was updated"
          : banner.isNew
            ? " is ready"
            : " updated"}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 flex-shrink-0",
          banner.isStale
            ? "text-destructive hover:text-destructive hover:bg-destructive/10"
            : "text-warning hover:text-warning hover:bg-warning/10"
        )}
        onClick={onDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
