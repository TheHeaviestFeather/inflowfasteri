import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanelSkeleton } from "./ChatPanelSkeleton";
import { ArtifactCanvasSkeleton } from "./ArtifactCanvasSkeleton";

export function WorkspaceSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header skeleton */}
      <header className="h-14 border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-[400px] border-r border-border">
          <ChatPanelSkeleton />
        </div>

        {/* Artifact canvas */}
        <div className="flex-1">
          <ArtifactCanvasSkeleton />
        </div>
      </div>
    </div>
  );
}
