/** Persian formatting helpers — fa-IR locale everywhere. */

const nf = new Intl.NumberFormat("fa-IR");

export function faNum(n: number): string {
  return nf.format(n);
}

const nfFrac = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

/** Compact toman: ۱۵ میلیارد تومان / ۸۵ میلیون تومان — always Persian digits. */
export function toman(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n) || n <= 0) return "توافقی";
  if (n >= 1_000_000_000) return `${nfFrac.format(n / 1_000_000_000)} میلیارد تومان`;
  if (n >= 1_000_000) return `${nfFrac.format(n / 1_000_000)} میلیون تومان`;
  return `${nf.format(n)} تومان`;
}

export function faDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function faDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function pct(score: number): string {
  return `${faNum(Math.round(score * 100))}٪`;
}

export const PROPERTY_TYPE_FA: Record<string, string> = {
  apartment: "آپارتمان",
  villa: "ویلا",
  land: "زمین",
  commercial: "تجاری",
};

export const TRANSACTION_TYPE_FA: Record<string, string> = {
  sale: "فروش",
  rent: "اجاره",
  exchange: "معاوضه",
};

export const DEAL_STAGES: { key: string; label: string }[] = [
  { key: "lead", label: "سرنخ" },
  { key: "qualification", label: "احراز نیاز" },
  { key: "property_match", label: "تطبیق ملک" },
  { key: "visit", label: "بازدید" },
  { key: "negotiation", label: "مذاکره" },
  { key: "agreement", label: "توافق" },
  { key: "closed_won", label: "قطعی شده" },
];

export function dealStageLabel(status: string): string {
  if (status === "closed_lost") return "از دست رفته";
  return DEAL_STAGES.find((s) => s.key === status)?.label ?? status;
}
