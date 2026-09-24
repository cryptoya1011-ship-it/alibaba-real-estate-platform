import { useEffect, useState, type ReactNode } from "react";
import { Building2, Check, Copy, Inbox, Loader2, X } from "lucide-react";
import { cn } from "../lib/cn";
import { pct } from "../lib/format";
import type { MatchItem } from "../lib/types";

/* ── Button ──────────────────────────────────────────────────────────── */
type BtnVariant = "primary" | "gold" | "soft" | "outline" | "ghost" | "danger" | "dangerSoft";
type BtnSize = "xs" | "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-brand text-white shadow-sm hover:brightness-110 dark:text-slate-900",
    gold: "bg-gold text-white shadow-sm hover:brightness-110 dark:text-slate-900",
    soft: "bg-brand-soft text-brand hover:brightness-105 dark:text-teal-200",
    outline: "border border-line bg-surface text-ink hover:bg-raise",
    ghost: "text-muted hover:bg-raise hover:text-ink",
    danger: "bg-danger text-white hover:brightness-110",
    dangerSoft: "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15",
  };
  const sizes: Record<BtnSize, string> = {
    xs: "h-7 px-2.5 text-[11px] rounded-lg gap-1",
    sm: "h-8 px-3 text-xs rounded-[10px] gap-1.5",
    md: "h-10 px-4 text-sm rounded-xl gap-2",
    lg: "h-12 px-5 text-sm rounded-xl gap-2 w-full",
  };
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconBtn({
  label,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-all duration-150 hover:bg-raise hover:text-ink active:scale-95",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────── */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHead({ title, desc, action, icon }: { title: string; desc?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand dark:text-teal-200">{icon}</div>
        )}
        <div>
          <h1 className="text-base font-bold md:text-lg">{title}</h1>
          {desc && <p className="mt-0.5 text-[11px] text-muted md:text-xs">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ── Badge ───────────────────────────────────────────────────────────── */
type Tone = "brand" | "gold" | "ok" | "warn" | "danger" | "muted";
export function Badge({ tone = "muted", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    brand: "bg-brand-soft text-brand dark:text-teal-200",
    gold: "bg-gold/15 text-gold",
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    muted: "bg-raise text-muted",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/* ── Form controls ───────────────────────────────────────────────────── */
const fieldCls =
  "w-full rounded-xl border border-line bg-raise px-3 text-sm text-ink placeholder:text-muted/60 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldCls, "h-10", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldCls, "min-h-[72px] py-2", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldCls, "h-10 appearance-none", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-muted/70">{hint}</span>}
    </label>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200", on ? "bg-brand" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200",
          on ? "start-[calc(100%-1.375rem)]" : "start-0.5",
        )}
      />
    </button>
  );
}

/* ── Modal / Confirm ─────────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={cn(
          "max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface shadow-pop animate-sheet-up sm:rounded-3xl sm:animate-scale-in",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <h3 className="text-sm font-bold">{title}</h3>
          <IconBtn label="بستن" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  desc,
  confirmLabel = "تأیید",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  desc?: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {desc && <p className="mb-4 text-xs leading-6 text-muted">{desc}</p>}
      <div className="flex gap-2">
        <Button
          variant={danger ? "danger" : "primary"}
          className="flex-1"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          انصراف
        </Button>
      </div>
    </Modal>
  );
}

/* ── States ──────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-line/60", className)} />;
}

export function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-4">
          <Skeleton className="mb-3 h-4 w-2/3" />
          <Skeleton className="mb-2 h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </Card>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-raise text-muted">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div className="text-sm font-bold">{title}</div>
      {desc && <div className="mt-1 max-w-xs text-xs leading-5 text-muted">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Data display ────────────────────────────────────────────────────── */
export function Stat({ label, value, icon, tone = "brand" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    brand: "bg-brand-soft text-brand dark:text-teal-200",
    gold: "bg-gold/15 text-gold",
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    muted: "bg-raise text-muted",
  };
  return (
    <Card className="flex items-center gap-3 p-3.5">
      {icon && <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className="tnum truncate text-base font-bold leading-5">{value}</div>
        <div className="text-[10px] text-muted">{label}</div>
      </div>
    </Card>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 0.7 ? "bg-ok" : score >= 0.5 ? "bg-warn" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.round(score * 100)}%` }} />
      </div>
      <span className="tnum w-10 text-end text-[10px] font-bold text-muted">{pct(score)}</span>
    </div>
  );
}

export function CopyBtn({ text, label = "کپی" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconBtn
      label={label}
      className={cn("h-7 w-7", done && "text-ok")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard may be blocked — ignore */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </IconBtn>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <span className="ltr inline-block rounded-md bg-raise px-1.5 py-0.5 font-mono text-[10px] text-muted" dir="ltr">
      {children}
    </span>
  );
}

/* ── Matches list (AI) ───────────────────────────────────────────────── */
export function MatchesList({ matches }: { matches: MatchItem[] }) {
  if (matches.length === 0) return <EmptyState title="موردی یافت نشد" desc="هیچ تطبیقی با امتیاد قابل قبول پیدا نشد." />;
  return (
    <ul className="space-y-2">
      {matches.map((m, i) => (
        <li key={i} className="rounded-xl border border-line bg-raise/50 p-3 animate-slide-up">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px]">
              <Badge tone={m.matched ? "ok" : "warn"}>{m.matched ? "مطابق" : "نزدیک"}</Badge>
              {m.provider && <span className="text-muted">{m.provider}</span>}
            </div>
          </div>
          <ScoreBar score={m.score} />
          {m.property && (
            <div className="mt-2 text-[11px]">
              <span className="font-bold">{m.property.title}</span> <Code>{m.property.code}</Code>
            </div>
          )}
          {m.request && (
            <div className="mt-1 text-[10px] text-muted">
              درخواست #{m.request.id} — {m.request.property_type} — {m.request.city_code} — بودجه {m.request.budget_max?.toLocaleString("fa-IR")}
            </div>
          )}
          {m.reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {m.reasons.map((r, j) => (
                <span key={j} className="rounded-full bg-surface px-2 py-0.5 text-[9px] text-muted border border-line">
                  {r}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ── Brand logo ──────────────────────────────────────────────────────── */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-16 w-16 rounded-3xl" : size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const i = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className={cn("flex items-center justify-center bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm dark:from-teal-400 dark:to-teal-600", s)}>
      <Building2 className={i} />
    </div>
  );
}
