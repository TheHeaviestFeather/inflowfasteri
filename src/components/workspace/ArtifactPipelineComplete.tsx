/**
 * Pipeline completion celebration component
 * Shows success state when all artifacts are approved
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Loader2, PartyPopper } from "lucide-react";

interface ArtifactPipelineCompleteProps {
  totalArtifacts: number;
  onExport: () => Promise<void>;
  isExporting: boolean;
}

export function ArtifactPipelineComplete({
  totalArtifacts,
  onExport,
  isExporting,
}: ArtifactPipelineCompleteProps) {
  const [showCelebration, setShowCelebration] = useState(false);

  const handleExport = async () => {
    await onExport();
    setShowCelebration(false);
  };

  return (
    <>
      {/* Inline indicator */}
      <div className="p-4 border-t bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <PartyPopper className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-emerald-600 text-sm">Pipeline Complete!</p>
            <p className="text-xs text-muted-foreground">All deliverables approved</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCelebration(true)}>
            View Summary
          </Button>
        </div>
      </div>

      {/* Celebration Modal */}
      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="text-5xl mb-2">🎉</div>
            <DialogTitle className="text-xl">You did it!</DialogTitle>
            <DialogDescription>
              Your complete training design package is ready.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center gap-8 py-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{totalArtifacts}</p>
              <p className="text-sm text-muted-foreground">Deliverables</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-500">100%</p>
              <p className="text-sm text-muted-foreground">Complete</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Full PDF Package
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCelebration(false)}
              className="w-full"
            >
              Continue Editing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
