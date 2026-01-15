import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArtifactType, ARTIFACT_ORDER, QUICK_MODE_ARTIFACTS } from "@/types/database";
import { Download, Loader2, PartyPopper } from "lucide-react";
import { Artifact } from "@/types/database";

interface PipelineCompleteSectionProps {
  isQuickMode: boolean;
  artifacts: Artifact[];
  isExporting: boolean;
  onExport: () => void;
  getArtifactByType: (type: ArtifactType) => Artifact | undefined;
}

export function PipelineCompleteSection({
  isQuickMode,
  artifacts,
  isExporting,
  onExport,
  getArtifactByType,
}: PipelineCompleteSectionProps) {
  const [showCelebration, setShowCelebration] = useState(false);

  const relevantArtifacts = isQuickMode ? QUICK_MODE_ARTIFACTS : ARTIFACT_ORDER;
  const allApproved = relevantArtifacts.every(type => {
    const artifact = getArtifactByType(type);
    return artifact?.status === "approved";
  });

  if (!allApproved) {
    return null;
  }

  return (
    <>
      {/* Inline indicator */}
      <div className="p-4 border-t bg-gradient-to-r from-success/10 via-success/10 to-success/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
            <PartyPopper className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-success text-sm">Pipeline Complete!</p>
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
              <p className="text-3xl font-bold text-primary">{relevantArtifacts.length}</p>
              <p className="text-sm text-muted-foreground">Deliverables</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-success">100%</p>
              <p className="text-sm text-muted-foreground">Complete</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                onExport();
                setShowCelebration(false);
              }}
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
