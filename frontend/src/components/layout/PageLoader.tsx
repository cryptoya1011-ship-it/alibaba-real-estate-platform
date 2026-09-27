import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

export function PageLoader() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="در حال بارگذاری">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <ListSkeleton count={3} />
    </div>
  );
}

export function FullScreenLoader({ label = "در حال آماده‌سازی…" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-hero">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-14">
          <span className="absolute inset-0 animate-ping rounded-[16px] bg-primary/30" />
          <span className="relative grid size-14 place-items-center rounded-[16px] bg-gradient-primary text-primary-foreground shadow-lg">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10.5 12 4l9 6.5" />
              <path d="M5 9.5V20h14V9.5" />
              <path d="M10 20v-5.5h4V20" />
            </svg>
          </span>
        </div>
        <p className="text-body text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
