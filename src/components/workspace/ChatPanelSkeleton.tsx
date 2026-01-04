import { Skeleton } from "@/components/ui/skeleton";

export function ChatPanelSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
          {/* User message skeleton */}
          <div className="flex justify-end">
            <div className="max-w-[80%] space-y-2">
              <Skeleton className="h-4 w-48 ml-auto" />
              <Skeleton className="h-16 w-64 rounded-2xl" />
            </div>
          </div>

          {/* Assistant message skeleton */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* User message skeleton */}
          <div className="flex justify-end">
            <div className="max-w-[80%] space-y-2">
              <Skeleton className="h-4 w-32 ml-auto" />
              <Skeleton className="h-12 w-56 rounded-2xl" />
            </div>
          </div>

          {/* Assistant message skeleton */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
