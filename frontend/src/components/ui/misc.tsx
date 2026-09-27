import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { faNum, percent } from "@/lib/format";
import { Button, type ButtonProps } from "./button";

/** Codes / IDs / slugs — always LTR + mono so they never break RTL flow. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={cn("inline-block font-mono text-[12px] tracking-wide text-muted-foreground [unicode-bidi:isolate]", className)}>
      {children}
    </span>
  );
}

export async function copyText(text: string, success = "کپی شد") {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.className = "fixed -top-96 opacity-0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.success(success);
    return true;
  } catch {
    toast.error("کپی انجام نشد؛ لطفاً دستی کپی کنید");
    return false;
  }
}

export function CopyButton({
  text,
  label,
  success,
  ...props
}: { text: string; label?: string; success?: string } & Omit<ButtonProps, "onClick">) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size={label ? "sm" : "icon-sm"}
      aria-label={label ?? "کپی"}
      onClick={async () => {
        if (await copyText(text, success)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
      {...props}
    >
      {done ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
      {label}
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="hidden size-11 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-primary sm:grid">
            <Icon className="size-[22px]" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-display font-bold tracking-tight">{title}</h1>
          {description && <p className="text-body text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  className,
}: {
  label: string;
  value: number | string | null | undefined;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "info" | "success" | "warning" | "danger";
  hint?: ReactNode;
  className?: string;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div className={cn("flex flex-col gap-3 rounded-[16px] bg-card p-4 hairline shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-[10px]", tones[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="tnum text-display font-bold leading-none">{typeof value === "number" ? faNum(value) : value ?? "—"}</div>
      {hint && <div className="text-caption text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** 0–1 score visualised as an animated bar with colour thresholds. */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const clamped = Math.max(0, Math.min(1, score));
  const tone = clamped >= 0.7 ? "bg-success" : clamped >= 0.5 ? "bg-warning" : "bg-muted-foreground";
  const text = clamped >= 0.7 ? "text-success" : clamped >= 0.5 ? "text-warning" : "text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={clamped}
        aria-label="امتیاز تطبیق"
      >
        <motion.div
          className={cn("h-full rounded-full", tone)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className={cn("tnum w-11 text-end text-caption font-bold", text)}>{percent(clamped)}</span>
    </div>
  );
}

export type TimelineItem = { id: string | number; title: ReactNode; meta?: ReactNode; body?: ReactNode; tone?: "primary" | "success" | "danger" | "neutral" };

export function Timeline({ items }: { items: TimelineItem[] }) {
  const tones = { primary: "bg-primary", success: "bg-success", danger: "bg-danger", neutral: "bg-muted-foreground" };
  return (
    <ol className="relative flex flex-col gap-5 ps-6">
      <span aria-hidden className="absolute inset-y-1.5 start-[7px] w-px bg-border-strong" />
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="relative"
        >
          <span
            aria-hidden
            className={cn("absolute -start-6 top-1 size-[15px] rounded-full ring-4 ring-popover", tones[item.tone ?? "primary"])}
          />
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold">{item.title}</div>
            {item.meta && <div className="text-caption text-muted-foreground">{item.meta}</div>}
            {item.body && <div className="mt-1 text-body text-muted-foreground">{item.body}</div>}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = name.trim().charAt(0) || "؟";
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-body font-bold text-primary-foreground",
        className,
      )}
    >
      {letter}
    </span>
  );
}

/** Staggered list entrance container + item. */
export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } },
};

export function StaggerList({ children, className, as = "ul" }: { children: ReactNode; className?: string; as?: "ul" | "div" }) {
  const Comp = as === "ul" ? motion.ul : motion.div;
  return (
    <Comp variants={listVariants} initial="hidden" animate="show" className={className}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "li" }: { children: ReactNode; className?: string; as?: "li" | "div" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp variants={itemVariants} className={cn("min-w-0", className)} layout="position">
      {children}
    </Comp>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <h2 className="text-title font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function KeyValue({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-[12px] bg-card-2 px-3 py-2.5 hairline", className)}>
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="tnum font-semibold">{value}</span>
    </div>
  );
}
