import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] bg-gradient-primary text-primary-foreground shadow-md shadow-primary/25", className)}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 4l9 6.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M10 20v-5.5h4V20" />
        <circle cx="17.5" cy="6" r="1.4" className="fill-accent stroke-none" />
      </svg>
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-title font-bold tracking-tight">علی‌بابا</span>
          <span className="text-[11px] text-muted-foreground">پلتفرم مدیریت املاک</span>
        </span>
      )}
    </span>
  );
}
