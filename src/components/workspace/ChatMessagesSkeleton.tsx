import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChatMessagesSkeletonProps {
  isMobile?: boolean;
}

export function ChatMessagesSkeleton({ isMobile }: ChatMessagesSkeletonProps) {
  return (
    <div className={cn(
      "max-w-3xl mx-auto space-y-4 sm:space-y-6",
      isMobile ? "py-4 px-3" : "py-6 px-4"
    )}>
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          <Skeleton className="h-3 w-20 ml-auto" />
          <Skeleton className="h-14 w-52 rounded-2xl" />
        </div>
      </div>

      {/* Assistant message skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>

      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          <Skeleton className="h-3 w-16 ml-auto" />
          <Skeleton className="h-10 w-44 rounded-2xl" />
        </div>
      </div>

      {/* Assistant message skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}
