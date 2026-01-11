/**
 * Parse error banner with actionable options
 */

import { AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ParseErrorBannerProps {
  error: string;
  rawContent?: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ParseErrorBanner({ 
  error, 
  rawContent, 
  onRetry, 
  onDismiss 
}: ParseErrorBannerProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <>
      <div className="mx-4 mb-4 px-4 py-3 rounded-lg border bg-amber-500/10 border-amber-500/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-amber-700 dark:text-amber-400">
              Couldn't parse AI response
            </p>
            <p className="text-xs text-amber-600/80 mt-1">
              {error}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-8 text-amber-700"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
            
            {rawContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRaw(true)}
                className="h-8 text-amber-700"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                View Raw
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Raw Response Dialog */}
      <Dialog open={showRaw} onOpenChange={setShowRaw}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Raw AI Response</DialogTitle>
            <DialogDescription>
              This is the unparsed response from the AI. You can copy this for debugging.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-muted rounded-lg overflow-auto max-h-[50vh]">
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {rawContent}
            </pre>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(rawContent || "");
              }}
            >
              Copy to Clipboard
            </Button>
            <Button onClick={() => setShowRaw(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
