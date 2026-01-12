import { cn } from "@/lib/utils";
import { Artifact, ArtifactType, ARTIFACT_LABELS } from "@/types/database";
import { FileText, Check, AlertTriangle, Clock } from "lucide-react";

interface ArtifactCardProps {
  type: ArtifactType;
  artifact?: Artifact;
  isSelected?: boolean;
  onClick?: () => void;
  phaseNumber?: number;
}

export function ArtifactCard({ type, artifact, isSelected, onClick, phaseNumber }: ArtifactCardProps) {
  const status = artifact?.status;
  const hasContent = artifact && artifact.content.length > 0;

  const getStatusStyles = () => {
    if (!hasContent) return "status-empty";
    switch (status) {
      case "approved":
        return "status-approved";
      case "stale":
        return "status-stale";
      case "draft":
      default:
        return "status-draft";
    }
  };

  const getStatusIcon = () => {
    if (!hasContent) return <Clock className="h-3 w-3" />;
    switch (status) {
      case "approved":
        return <Check className="h-3 w-3" />;
      case "stale":
        return <AlertTriangle className="h-3 w-3" />;
      case "draft":
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  return (
    <button
      onClick={onClick}
      aria-label={`${ARTIFACT_LABELS[type]}, status: ${!hasContent ? "Empty" : status}`}
      aria-pressed={isSelected}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200",
        "hover:bg-muted/50 hover:border-primary/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? "bg-primary/10 border-primary"
          : "bg-card border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
            hasContent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {phaseNumber ? (
            <span className="text-sm font-medium">{phaseNumber}</span>
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium truncate">
              {ARTIFACT_LABELS[type]}
            </h4>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                getStatusStyles()
              )}
            >
              {getStatusIcon()}
              {!hasContent ? "Empty" : status}
            </span>
          </div>
          {hasContent && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {artifact.content.substring(0, 100)}...
            </p>
          )}
          {artifact?.version && (
            <p className="text-xs text-muted-foreground mt-1">
              v{artifact.version}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
