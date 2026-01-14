import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Artifact, ARTIFACT_LABELS } from "@/types/database";
import { ArrowLeft, Check, Clock, AlertTriangle, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { ArtifactActions, AIDisclaimer } from "./ArtifactActions";
import { formatArtifactContent } from "@/utils/artifactFormatter";
interface ArtifactViewerProps {
  artifact: Artifact;
  onBack: () => void;
  onApprove?: (artifactId: string) => void;
  onRegenerate?: (artifactType: string) => void;
  isRegenerating?: boolean;
}

export function ArtifactViewer({ artifact, onBack, onApprove, onRegenerate, isRegenerating }: ArtifactViewerProps) {
  // Format the artifact content to handle JSON extraction and markdown cleanup
  const formattedContent = useMemo(() => {
    if (!artifact.content) return "";
    return formatArtifactContent(artifact.content, artifact.artifact_type);
  }, [artifact.content, artifact.artifact_type]);

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

      {artifact.content && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <ArtifactActions 
            artifact={artifact} 
            onRegenerate={onRegenerate ? () => onRegenerate(artifact.artifact_type) : undefined}
            isRegenerating={isRegenerating}
          />
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        {artifact.content ? (
          <div>
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:text-sidebar-foreground prose-headings:font-semibold prose-headings:tracking-tight
              prose-h1:text-lg prose-h1:mt-8 prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-border/50
              prose-h2:text-base prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-sm prose-h3:mt-6 prose-h3:mb-3 prose-h3:font-semibold
              prose-h4:text-sm prose-h4:mt-5 prose-h4:mb-2
              prose-p:my-4 prose-p:leading-relaxed prose-p:text-sidebar-foreground/85
              prose-ul:my-4 prose-ul:pl-5 prose-ul:list-disc
              prose-ol:my-4 prose-ol:pl-5 prose-ol:list-decimal
              prose-li:my-2 prose-li:leading-relaxed prose-li:text-sidebar-foreground/85
              [&_ul_ul]:mt-2 [&_ul_ul]:mb-0 [&_li>ul]:pl-4 [&_li>ul]:my-2
              [&_ol_ol]:mt-2 [&_ol_ol]:mb-0 [&_li>ol]:pl-4 [&_li>ol]:my-2
              prose-strong:font-semibold prose-strong:text-sidebar-foreground
              prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:bg-muted/40 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-5 prose-blockquote:italic prose-blockquote:text-sidebar-foreground/80
              prose-hr:my-8 prose-hr:border-border/50
              prose-table:w-full prose-table:my-6 prose-table:border-collapse prose-table:text-xs
              prose-thead:bg-muted/50 prose-thead:border-b prose-thead:border-border
              prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-sidebar-foreground prose-th:border prose-th:border-border/50
              prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border/50 prose-td:text-sidebar-foreground/85
              prose-tr:border-b prose-tr:border-border/30
              [&_table]:rounded-md [&_table]:overflow-hidden [&_table]:border [&_table]:border-border/50
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                {formattedContent}
              </ReactMarkdown>
            </div>
            <AIDisclaimer />
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

      {artifact.content && onApprove && (
        <div className="p-4 border-t border-sidebar-border">
          {artifact.status === "approved" ? (
            <div className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-sky-500/15 text-sky-600 border border-sky-500/30">
              <Check className="h-4 w-4" />
              <span className="font-medium">Approved</span>
            </div>
          ) : (
            <Button
              onClick={() => onApprove(artifact.id)}
              className="w-full gap-2"
            >
              <Check className="h-4 w-4" />
              Approve Artifact
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
