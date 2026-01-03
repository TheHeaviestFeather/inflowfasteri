import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Artifact, ARTIFACT_LABELS } from "@/types/database";
import { ArrowLeft, Check, Clock, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtifactViewerProps {
  artifact: Artifact;
  onBack: () => void;
  onApprove?: (artifactId: string) => void;
}

export function ArtifactViewer({ artifact, onBack, onApprove }: ArtifactViewerProps) {
  const getStatusBadge = () => {
    switch (artifact.status) {
      case "approved":
        return (
          <Badge className="status-approved gap-1">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "stale":
        return (
          <Badge className="status-stale gap-1">
            <AlertTriangle className="h-3 w-3" />
            Stale
          </Badge>
        );
      case "draft":
      default:
        return (
          <Badge className="status-draft gap-1">
            <Clock className="h-3 w-3" />
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="h-full w-96 bg-sidebar border-l border-sidebar-border flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sidebar-foreground truncate">
            {ARTIFACT_LABELS[artifact.artifact_type]}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge()}
            <span className="text-xs text-muted-foreground">v{artifact.version}</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {artifact.content ? (
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-sidebar-foreground">
              {artifact.content}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium text-muted-foreground">No content yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This artifact will be generated as you progress through the conversation.
            </p>
          </div>
        )}
      </ScrollArea>

      {artifact.content && artifact.status === "draft" && onApprove && (
        <div className="p-4 border-t border-sidebar-border">
          <Button
            onClick={() => onApprove(artifact.id)}
            className="w-full gap-2"
          >
            <Check className="h-4 w-4" />
            Approve Artifact
          </Button>
        </div>
      )}
    </div>
  );
}
