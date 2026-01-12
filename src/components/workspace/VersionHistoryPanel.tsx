/**
 * Version history panel for viewing and restoring artifact versions
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  ArrowLeft, 
  RotateCcw, 
  Clock,
  CheckCircle2,
  Loader2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ARTIFACT_LABELS, ArtifactType, Artifact } from "@/types/database";
import { artifactLogger } from "@/lib/logger";

interface ArtifactVersion {
  id: string;
  artifact_id: string;
  artifact_type: string;
  content: string;
  version: number;
  created_at: string;
}

interface VersionHistoryPanelProps {
  artifact: Artifact;
  onClose: () => void;
  onRestore: (content: string, version: number) => Promise<void>;
}

export function VersionHistoryPanel({ artifact, onClose, onRestore }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ArtifactVersion | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<ArtifactVersion | null>(null);

  useEffect(() => {
    async function fetchVersions() {
      setLoading(true);
      const { data, error } = await supabase
        .from("artifact_versions")
        .select("*")
        .eq("artifact_id", artifact.id)
        .order("version", { ascending: false });

      if (error) {
        artifactLogger.error("Error fetching versions", { error });
        toast.error("Failed to load version history");
      } else {
        setVersions(data || []);
      }
      setLoading(false);
    }

    fetchVersions();
  }, [artifact.id]);

  const handleRestoreRequest = (version: ArtifactVersion) => {
    if (version.version === artifact.version) {
      toast.info("This is already the current version");
      return;
    }
    setConfirmRestore(version);
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestore) return;
    
    setRestoringVersion(confirmRestore.version);
    try {
      await onRestore(confirmRestore.content, confirmRestore.version);
      toast.success(`Restored to version ${confirmRestore.version}`);
      onClose();
    } catch (err) {
      artifactLogger.error("Error restoring version", { error: err });
      toast.error("Failed to restore version");
    } finally {
      setRestoringVersion(null);
      setConfirmRestore(null);
    }
  };

  return (
    <div className="h-full w-96 bg-sidebar border-l border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sidebar-foreground flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ARTIFACT_LABELS[artifact.artifact_type as ArtifactType]}
          </p>
        </div>
      </div>

      {/* Version List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <History className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No version history available</p>
            <p className="text-xs text-muted-foreground mt-1">
              Versions are saved when content changes
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {/* Current version first */}
            <VersionItem
              version={{
                id: "current",
                artifact_id: artifact.id,
                artifact_type: artifact.artifact_type,
                content: artifact.content,
                version: artifact.version,
                created_at: artifact.updated_at,
              }}
              isCurrent={true}
              isSelected={selectedVersion === null}
              isRestoring={false}
              onSelect={() => setSelectedVersion(null)}
              onRestore={() => {}}
            />
            
            {/* Previous versions */}
            {versions
              .filter((v) => v.version !== artifact.version)
              .map((version) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isCurrent={false}
                  isSelected={selectedVersion?.id === version.id}
                  isRestoring={restoringVersion === version.version}
                  onSelect={() => setSelectedVersion(version)}
                  onRestore={() => handleRestoreRequest(version)}
                />
              ))}
          </div>
        )}
      </ScrollArea>

      {/* Preview of selected version */}
      {selectedVersion && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Version {selectedVersion.version} Preview</span>
            <Button
              size="sm"
              onClick={() => handleRestoreRequest(selectedVersion)}
              disabled={restoringVersion !== null}
              className="gap-1"
            >
              {restoringVersion === selectedVersion.version ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Restore
            </Button>
          </div>
          <ScrollArea className="h-32 rounded-md border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {selectedVersion.content.slice(0, 500)}
              {selectedVersion.content.length > 500 && "..."}
            </p>
          </ScrollArea>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmRestore !== null} onOpenChange={(open) => !open && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {confirmRestore?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current content with version {confirmRestore?.version}. 
              The current version will be saved to history before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Restore Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface VersionItemProps {
  version: ArtifactVersion;
  isCurrent: boolean;
  isSelected: boolean;
  isRestoring: boolean;
  onSelect: () => void;
  onRestore: () => void;
}

function VersionItem({ 
  version, 
  isCurrent, 
  isSelected, 
  isRestoring, 
  onSelect, 
  onRestore 
}: VersionItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        p-3 rounded-lg cursor-pointer transition-colors
        ${isSelected ? "bg-accent" : "hover:bg-accent/50"}
        ${isCurrent ? "border border-primary/30" : ""}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCurrent ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">Version {version.version}</span>
          {isCurrent && (
            <Badge variant="secondary" className="text-xs">
              Current
            </Badge>
          )}
        </div>
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            disabled={isRestoring}
            className="h-7 px-2 text-xs"
          >
            {isRestoring ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RotateCcw className="h-3 w-3 mr-1" />
                Restore
              </>
            )}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {format(new Date(version.created_at), "MMM d, yyyy 'at' h:mm a")}
      </p>
    </div>
  );
}
