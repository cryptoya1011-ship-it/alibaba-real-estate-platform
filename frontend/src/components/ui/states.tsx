import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, RotateCw, WifiOff, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { ApiError } from "@/api";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-border-strong bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-title font-semibold">{title}</p>
        {description && <p className="max-w-sm text-body text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  title: "عنوان",
  price: "قیمت",
  rent_price: "اجاره",
  deposit: "ودیعه",
  built_area: "متراژ بنا",
  land_area: "متراژ زمین",
  owner_share: "سهم مالک",
  builder_share: "سهم سازنده",
  owner_phone: "تلفن مالک",
  phone: "تلفن",
  first_name: "نام",
  city_code: "کد شهر",
  district_code: "کد منطقه",
  name: "نام",
  slug: "شناسه",
  code: "کد",
  file: "فایل",
};

export function errorMessage(err: unknown, fallback = "خطایی رخ داد"): string {
  if (err instanceof ApiError) {
    if (err.status === 403 || err.code === "FORBIDDEN") {
      // Prefer the server's specific reason (e.g. "owner cannot be changed").
      return err.message && err.message !== "دسترسی لازم را ندارید" ? err.message : "برای این بخش دسترسی ندارید";
    }
    if (err.code === "NETWORK_ERROR") return "اتصال به سرور برقرار نشد؛ اینترنت یا سرور را بررسی کنید";
    if (err.code === "VALIDATION_ERROR" && err.details.length > 0) {
      const first = err.details[0] as { field?: string; message?: string };
      const key = first?.field?.split(".").pop() ?? "";
      const label = FIELD_LABELS[key];
      return `${err.message}${label ? ` (${label})` : ""}`;
    }
    return err.message;
  }
  return fallback;
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const forbidden = error instanceof ApiError && (error.status === 403 || error.code === "FORBIDDEN");
  const network = error instanceof ApiError && (error.code === "NETWORK_ERROR" || error.code === "SERVER_UNAVAILABLE");
  const Icon = forbidden ? Lock : network ? WifiOff : AlertTriangle;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-[16px] border border-danger/25 bg-danger-soft/60 px-6 py-8 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{forbidden ? "دسترسی محدود است" : "بارگذاری ناموفق بود"}</p>
        <p className="text-body text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && !forbidden && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}
