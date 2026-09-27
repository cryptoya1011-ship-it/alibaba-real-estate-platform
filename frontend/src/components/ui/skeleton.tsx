import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-[10px]", className)} />;
}

/** Card-shaped skeleton that matches PropertyCard / ListCard layouts. */
export function CardSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[16px] bg-card hairline">
      {media && <Skeleton className="h-36 rounded-none" />}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-2/5" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4, media = false, grid = false }: { count?: number; media?: boolean; grid?: boolean }) {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری"
      className={cn("grid gap-3", grid && "sm:grid-cols-2 xl:grid-cols-3")}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} media={media} />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="در حال بارگذاری" className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[14px] bg-card p-3 hairline">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
