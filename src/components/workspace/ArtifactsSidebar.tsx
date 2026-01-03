import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtifactCard } from "./ArtifactCard";
import { ArtifactViewer } from "./ArtifactViewer";
import { Artifact, ArtifactType, ARTIFACT_ORDER, ARTIFACT_LABELS } from "@/types/database";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtifactsSidebarProps {
  artifacts: Artifact[];
  onApprove?: (artifactId: string) => void;
}

export function ArtifactsSidebar({ artifacts, onApprove }: ArtifactsSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedType, setSelectedType] = useState<ArtifactType | null>(null);

  const getArtifactByType = (type: ArtifactType) => {
    return artifacts.find((a) => a.artifact_type === type);
  };

  const selectedArtifact = selectedType ? getArtifactByType(selectedType) : null;

  if (selectedType && selectedArtifact) {
    return (
      <ArtifactViewer
        artifact={selectedArtifact}
        onBack={() => setSelectedType(null)}
        onApprove={onApprove}
      />
    );
  }

  return (
    <div
      className={cn(
        "h-full bg-sidebar border-l border-sidebar-border transition-all duration-300 flex flex-col",
        isExpanded ? "w-80" : "w-14"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {isExpanded && (
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-sidebar-primary" />
            <h2 className="font-semibold text-sidebar-foreground">Artifacts</h2>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8"
        >
          {isExpanded ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isExpanded ? (
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {ARTIFACT_ORDER.map((type) => (
              <ArtifactCard
                key={type}
                type={type}
                artifact={getArtifactByType(type)}
                onClick={() => setSelectedType(type)}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex flex-col items-center py-4 space-y-2">
          {ARTIFACT_ORDER.map((type) => {
            const artifact = getArtifactByType(type);
            const hasContent = artifact && artifact.content.length > 0;
            return (
              <button
                key={type}
                onClick={() => {
                  setIsExpanded(true);
                  setSelectedType(type);
                }}
                className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                  hasContent
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                title={ARTIFACT_LABELS[type]}
              >
                <span className="text-xs font-medium">
                  {ARTIFACT_LABELS[type].charAt(0)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
