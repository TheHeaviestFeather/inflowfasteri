import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Loader2, ChevronRight } from "lucide-react";

interface CanvasHeaderProps {
  isQuickMode: boolean;
  approvedCount: number;
  hasApprovedArtifacts: boolean;
  isExporting: boolean;
  onExport: () => void;
  onCollapse: () => void;
}

export function CanvasHeader({
  isQuickMode,
  approvedCount,
  hasApprovedArtifacts,
  isExporting,
  onExport,
  onCollapse,
}: CanvasHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-sm">Deliverables</h2>
        {isQuickMode && (
          <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
            Quick Mode
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onExport}
                disabled={!hasApprovedArtifacts || isExporting}
                className="h-8 w-8"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasApprovedArtifacts
                ? `Export ${approvedCount} approved deliverable${approvedCount > 1 ? 's' : ''} as PDF`
                : "Approve deliverables to export"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
