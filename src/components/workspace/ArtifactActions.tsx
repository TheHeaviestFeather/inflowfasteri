/**
 * Artifact action buttons - Copy, Edit, Export
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Copy, 
  Check, 
  Pencil, 
  Download, 
  Sparkles 
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Artifact } from "@/types/database";

interface ArtifactActionsProps {
  artifact: Artifact;
  onEdit?: () => void;
  onExport?: (format: "md" | "pdf") => void;
}

export function ArtifactActions({ artifact, onEdit, onExport }: ArtifactActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* AI-Generated Badge */}
      <Badge variant="outline" className="text-xs text-muted-foreground">
        <Sparkles className="w-3 h-3 mr-1" />
        AI Draft
      </Badge>

      <div className="flex items-center gap-1 ml-auto">
        {/* Copy Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span className="ml-1 text-xs">Copy</span>
        </Button>

        {/* Edit Button */}
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 px-2"
          >
            <Pencil className="w-4 h-4" />
            <span className="ml-1 text-xs">Edit</span>
          </Button>
        )}

        {/* Export Dropdown */}
        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExport("md")}
            className="h-8 px-2"
          >
            <Download className="w-4 h-4" />
            <span className="ml-1 text-xs">Export</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * AI-Generated content disclaimer
 */
export function AIDisclaimer() {
  return (
    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
      <Sparkles className="w-3 h-3" />
      AI-generated content. Review and edit before using.
    </p>
  );
}
