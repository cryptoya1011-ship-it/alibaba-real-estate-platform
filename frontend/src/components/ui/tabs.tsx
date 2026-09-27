import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type SegmentItem<T extends string> = { value: T; label: ReactNode; count?: number; icon?: ReactNode };

/**
 * Segmented / chip filter with a spring-animated active indicator.
 * Scrolls horizontally on small screens.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 py-0.5", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 font-medium transition-colors duration-200 [&_svg]:size-4",
              size === "sm" ? "h-9 text-caption" : "h-10 text-body",
              active ? "text-primary-foreground" : "bg-card text-muted-foreground hairline hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-primary shadow-md shadow-primary/25"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.icon}
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "tnum rounded-full px-1.5 text-[11px] leading-5",
                    active ? "bg-white/20" : "bg-muted",
                  )}
                >
                  {new Intl.NumberFormat("fa-IR").format(item.count)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Tab panels driven by Segmented. */
export function TabPanel({ when, value, children }: { when: string; value: string; children: ReactNode }) {
  if (when !== value) return null;
  return (
    <motion.div role="tabpanel" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      {children}
    </motion.div>
  );
}
