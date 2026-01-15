import { Badge } from "@/components/ui/badge";
import { ArtifactType, ARTIFACT_LABELS } from "@/types/database";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface ArtifactStreamingPreviewProps {
  selectedPhase: ArtifactType;
  streamingMessage: string;
}

// Extract readable content from streaming message for fallback display
function extractStreamingPreview(content: string): string {
  let preview = content;

  // Extract content after **DELIVERABLE:** if present
  const deliverableMatch = preview.match(/\*\*DELIVERABLE:\s*[^*]+\*\*\s*([\s\S]*)/i);
  if (deliverableMatch) {
    preview = deliverableMatch[1];
  }

  // Remove everything from STATE or ```json onward
  const cutPoints = [
    preview.search(/\nSTATE\b/i),
    preview.search(/\n```json\b/i),
    preview.search(/\n✅\s*Saved/i),
    preview.search(/\nCommands:/i),
  ].filter((i) => i >= 0);

  if (cutPoints.length > 0) {
    preview = preview.slice(0, Math.min(...cutPoints));
  }

  // Clean up
  return preview.trim();
}

export function ArtifactStreamingPreview({ selectedPhase, streamingMessage }: ArtifactStreamingPreviewProps) {
  const streamingPreview = extractStreamingPreview(streamingMessage);

  if (streamingPreview.length > 20) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{ARTIFACT_LABELS[selectedPhase]}</h3>
          <Badge className="status-draft gap-1 animate-pulse">
            <Sparkles className="h-3 w-3" />
            Generating...
          </Badge>
        </div>
        <div className={cn(
          "text-sm leading-relaxed bg-muted/30 rounded-lg p-6 border animate-pulse",
          "prose prose-sm max-w-none dark:prose-invert",
          "prose-headings:text-foreground prose-headings:font-semibold",
          "prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3",
          "prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2",
          "prose-p:my-4 prose-p:leading-7 prose-p:text-foreground/90",
          "prose-ul:my-4 prose-ul:pl-6 prose-ul:list-disc prose-ul:space-y-2",
          "prose-li:my-0 prose-li:leading-7 prose-li:text-foreground/90",
          "prose-strong:text-foreground prose-strong:font-semibold",
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        )}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{streamingPreview}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // Not enough content yet, show loading state
  return (
    <div className="flex flex-col items-center justify-center h-[400px] text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-medium mb-2">{ARTIFACT_LABELS[selectedPhase]}</h3>
      <p className="text-sm text-muted-foreground max-w-[250px]">
        Generating deliverable...
      </p>
    </div>
  );
}
