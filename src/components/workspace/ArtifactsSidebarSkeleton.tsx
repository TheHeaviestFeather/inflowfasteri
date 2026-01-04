import { Skeleton } from "@/components/ui/skeleton";

export function ArtifactsSidebarSkeleton() {
  return (
    <div className="h-full bg-sidebar border-l border-sidebar-border w-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Artifact cards */}
      <div className="flex-1 p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ArtifactCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function ArtifactCardSkeleton() {
  return (
    <div className="w-full p-3 rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
