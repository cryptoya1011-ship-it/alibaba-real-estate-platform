/** Persian (fa-IR) formatting helpers — digits, toman, Jalali dates. */

const faNumber = new Intl.NumberFormat("fa-IR");
const faDecimal = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const faDate = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" });
const faDateShort = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });
const faWeekdayDate = new Intl.DateTimeFormat("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const faDateTime = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const faTime = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });
const faRelative = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });

/** Render any number with Persian digits and thousands separators. */
export function faNum(value: number | string | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(toEnDigits(String(value)));
  if (Number.isNaN(n)) return String(value);
  return Number.isInteger(n) ? faNumber.format(n) : faDecimal.format(n);
}

/** Convert Latin digits inside any string to Persian digits (codes stay LTR-safe). */
export function faDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** Normalise Persian/Arabic digits + separators to a plain Latin number string. */
export function toEnDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٬,،\s]/g, "")
    .replace(/٫/g, ".");
}

/** Parse user input (may contain Persian digits / separators) into a number or null. */
export function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const clean = toEnDigits(value.trim());
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export function isNumeric(value: string): boolean {
  return value.trim() === "" || parseNumber(value) !== null;
}

/** Full toman amount: ۱۴٬۰۰۰٬۰۰۰٬۰۰۰ تومان */
export function formatToman(value: number | null | undefined, fallback = "توافقی"): string {
  if (value === null || value === undefined) return fallback;
  return `${faNumber.format(value)} تومان`;
}

/** Human, compact toman amount: ۱۴ میلیارد تومان · ۵۰۰ هزار تومان */
export function compactToman(value: number | null | undefined, fallback = "توافقی"): string {
  if (value === null || value === undefined) return fallback;
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, "هزار میلیارد"],
    [1e9, "میلیارد"],
    [1e6, "میلیون"],
    [1e3, "هزار"],
  ];
  for (const [size, label] of units) {
    if (abs >= size) {
      return `${faDecimal.format(Math.round((value / size) * 100) / 100)} ${label} تومان`;
    }
  }
  return `${faNumber.format(value)} تومان`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Backend returns naive UTC timestamps ("2026-09-24T12:15:24") — treat as UTC.
  const iso = /T\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? `${value}Z` : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Plain calendar date (YYYY-MM-DD) → Date at local midnight */
function toLocalDay(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return toDate(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDate(value: string | Date | null | undefined, fallback = "—"): string {
  const d = typeof value === "string" ? toLocalDay(value) : toDate(value);
  return d ? faDigits(faDate.format(d)) : fallback;
}

export function formatDateShort(value: string | Date | null | undefined, fallback = "—"): string {
  const d = typeof value === "string" ? toLocalDay(value) : toDate(value);
  return d ? faDigits(faDateShort.format(d)) : fallback;
}

export function formatWeekdayDate(value: string | Date | null | undefined, fallback = "—"): string {
  const d = typeof value === "string" ? toLocalDay(value) : toDate(value);
  return d ? faDigits(faWeekdayDate.format(d)) : fallback;
}

export function formatDateTime(value: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  return d ? faDigits(faDateTime.format(d)) : fallback;
}

/** "10:00:00" → "۱۰:۰۰" */
export function formatTime(value: string | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return faDigits(faTime.format(d));
}

export function relativeTime(value: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "همین حالا";
  if (abs < 3600) return faRelative.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return faRelative.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return faRelative.format(Math.round(diff / 86400), "day");
  return faDate.format(d);
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function percent(value: number): string {
  return `${faNumber.format(Math.round(value * 100))}٪`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("‌");
}

export function uid(prefix: string) {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${rand}`;
}
