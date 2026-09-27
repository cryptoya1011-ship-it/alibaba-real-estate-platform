/** Persian labels + enumerations shared across features. */
import type { DealStatus, PersonRole, PropertyStatus, PropertyType, TransactionType } from "./types";

export type Option<T extends string = string> = { value: T; label: string };

export const PROPERTY_TYPES: Option<PropertyType>[] = [
  { value: "apartment", label: "آپارتمان" },
  { value: "villa", label: "ویلا" },
  { value: "residential", label: "مسکونی" },
  { value: "land", label: "زمین" },
  { value: "commercial", label: "تجاری" },
  { value: "office", label: "دفتر کار" },
  { value: "administrative", label: "اداری" },
  { value: "garden", label: "باغ" },
  { value: "industrial", label: "صنعتی" },
  { value: "mixed_use", label: "چندمنظوره" },
];

export const TRANSACTION_TYPES: Option<TransactionType>[] = [
  { value: "sale", label: "فروش" },
  { value: "rent", label: "اجاره" },
  { value: "exchange", label: "معاوضه" },
  { value: "partnership", label: "مشارکت" },
];

export const PROPERTY_STATUSES: Option<PropertyStatus>[] = [
  { value: "draft", label: "پیش‌نویس" },
  { value: "pending_review", label: "در انتظار بررسی" },
  { value: "changes_requested", label: "نیازمند اصلاح" },
  { value: "rejected", label: "ردشده" },
  { value: "approved", label: "تأییدشده" },
  { value: "published", label: "منتشرشده" },
  { value: "reserved", label: "رزروشده" },
  { value: "sold", label: "فروخته‌شده" },
  { value: "rented", label: "اجاره‌رفته" },
  { value: "archived", label: "بایگانی" },
];

export const PERSON_ROLES: Option<PersonRole>[] = [
  { value: "buyer", label: "خریدار" },
  { value: "seller", label: "فروشنده" },
  { value: "owner", label: "مالک" },
  { value: "tenant", label: "مستأجر" },
  { value: "landlord", label: "موجر" },
  { value: "investor", label: "سرمایه‌گذار" },
  { value: "developer", label: "سازنده" },
  { value: "intermediary", label: "واسطه" },
];

export const CITIES: { code: string; name: string }[] = [
  { code: "ISF", name: "اصفهان" },
  { code: "THR", name: "تهران" },
  { code: "SHZ", name: "شیراز" },
  { code: "MSH", name: "مشهد" },
  { code: "TBZ", name: "تبریز" },
];

export const DISTRICTS: { code: string; name: string; city: string }[] = [
  { code: "MJ", name: "مرداویج", city: "ISF" },
  { code: "CB", name: "چهارباغ", city: "ISF" },
  { code: "JLF", name: "جلفا", city: "ISF" },
  { code: "NZR", name: "نظر", city: "ISF" },
  { code: "HZJ", name: "هزارجریب", city: "ISF" },
  { code: "SPH", name: "سپاهان‌شهر", city: "ISF" },
  { code: "BZR", name: "بزرگمهر", city: "ISF" },
  { code: "KHK", name: "خاقانی", city: "ISF" },
  { code: "AMD", name: "آمادگاه", city: "ISF" },
  { code: "SHG", name: "شهرک غرب", city: "THR" },
  { code: "SAD", name: "سعادت‌آباد", city: "THR" },
  { code: "VAL", name: "ولیعصر", city: "THR" },
  { code: "JOR", name: "جردن", city: "THR" },
  { code: "ZAF", name: "زعفرانیه", city: "THR" },
];

/** Main forward pipeline used by the «مرحله بعد» button. */
export const DEAL_PIPELINE: DealStatus[] = [
  "lead",
  "qualification",
  "property_match",
  "visit",
  "negotiation",
  "agreement",
  "closed_won",
];

export const DEAL_STAGES: Record<DealStatus, { label: string; tone: Tone }> = {
  lead: { label: "سرنخ", tone: "neutral" },
  qualification: { label: "ارزیابی", tone: "info" },
  property_match: { label: "تطبیق ملک", tone: "info" },
  visit: { label: "بازدید", tone: "primary" },
  negotiation: { label: "مذاکره", tone: "accent" },
  agreement: { label: "توافق", tone: "warning" },
  closed_won: { label: "موفق", tone: "success" },
  closed_lost: { label: "ناموفق", tone: "danger" },
  archived: { label: "بایگانی", tone: "neutral" },
};

/** Mirrors backend ALLOWED_TRANSITIONS (deals/service.py) for UI affordances only. */
export const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  lead: ["qualification", "closed_lost", "archived"],
  qualification: ["property_match", "closed_lost", "archived"],
  property_match: ["visit", "negotiation", "closed_lost", "archived"],
  visit: ["negotiation", "property_match", "closed_lost", "archived"],
  negotiation: ["agreement", "closed_lost", "archived"],
  agreement: ["closed_won", "closed_lost", "archived"],
  closed_won: ["archived"],
  closed_lost: ["lead", "archived"],
  archived: [],
};

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

export const VISIT_STATUSES: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: "برنامه‌ریزی‌شده", tone: "info" },
  confirmed: { label: "تأییدشده", tone: "primary" },
  completed: { label: "انجام‌شده", tone: "success" },
  done: { label: "انجام‌شده", tone: "success" },
  cancelled: { label: "لغوشده", tone: "danger" },
  no_show: { label: "عدم حضور", tone: "warning" },
  rescheduled: { label: "زمان‌بندی مجدد", tone: "accent" },
};

/** Statuses accepted by the backend (visits/service.py VALID_STATUSES). */
export const VISIT_STATUS_OPTIONS = ["scheduled", "done", "rescheduled", "no_show", "cancelled"].map((value) => ({
  value,
  label: VISIT_STATUSES[value].label,
}));

export const PROPERTY_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  pending_review: "warning",
  changes_requested: "warning",
  rejected: "danger",
  approved: "info",
  published: "success",
  reserved: "accent",
  sold: "primary",
  rented: "primary",
  archived: "neutral",
};

export const NOTIFICATION_PRIORITY: Record<string, { label: string; tone: Tone }> = {
  normal: { label: "عادی", tone: "info" },
  important: { label: "مهم", tone: "warning" },
  critical: { label: "بحرانی", tone: "danger" },
};

export const INVITATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "در انتظار", tone: "warning" },
  accepted: { label: "پذیرفته‌شده", tone: "success" },
  revoked: { label: "لغوشده", tone: "danger" },
  expired: { label: "منقضی", tone: "neutral" },
};

export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  organization_admin: "مدیر سازمان",
  branch_admin: "مدیر شعبه",
  manager: "مدیر",
  agent: "مشاور املاک",
  observer: "ناظر (فقط مشاهده)",
};

/** Statuses a consultant may choose; everything else is the official inventory (manager only). */
export const SUBMISSION_STATUSES: PropertyStatus[] = ["draft", "pending_review"];
export const PERM_PROPERTY_APPROVE = "property:approve";
export const PERM_COMMISSION_MANAGE = "commission:manage";

/** All permission codes (mirror of backend core/permissions.py ALL_PERMISSIONS). */
export const PERMISSION_GROUPS: { key: string; label: string; items: { code: string; label: string }[] }[] = [
  {
    key: "organization",
    label: "سازمان و شعبه",
    items: [
      { code: "organization:read", label: "مشاهده سازمان" },
      { code: "organization:update", label: "ویرایش سازمان" },
      { code: "organization:member:invite", label: "دعوت عضو" },
      { code: "organization:member:read", label: "مشاهده اعضا" },
      { code: "branch:read", label: "مشاهده شعب" },
      { code: "branch:manage", label: "مدیریت شعب" },
      { code: "role:manage", label: "مدیریت نقش‌ها" },
    ],
  },
  {
    key: "property",
    label: "املاک",
    items: [
      { code: "property:create", label: "ثبت ملک" },
      { code: "property:read", label: "مشاهده ملک" },
      { code: "property:update", label: "ویرایش ملک" },
      { code: "property:delete", label: "حذف ملک" },
      { code: "property:address:read", label: "مشاهده آدرس دقیق" },
      { code: "property:owner:read", label: "مشاهده اطلاعات مالک" },
      { code: "property:approve", label: "تأیید، رد و انتشار ملک (موجودی رسمی)" },
      { code: "favorite:manage", label: "علاقه‌مندی‌ها" },
      { code: "saved_search:manage", label: "جستجوهای ذخیره‌شده" },
    ],
  },
  {
    key: "customer",
    label: "مشتریان",
    items: [
      { code: "customer:create", label: "ثبت مشتری" },
      { code: "customer:read", label: "مشاهده مشتری" },
      { code: "customer:update", label: "ویرایش مشتری" },
      { code: "customer:delete", label: "حذف مشتری" },
      { code: "customer_request:create", label: "ثبت درخواست" },
      { code: "customer_request:read", label: "مشاهده درخواست" },
      { code: "customer_request:update", label: "ویرایش درخواست" },
    ],
  },
  {
    key: "visit",
    label: "بازدید و اعلان",
    items: [
      { code: "visit:create", label: "ثبت بازدید" },
      { code: "visit:read", label: "مشاهده بازدید" },
      { code: "visit:update", label: "ویرایش بازدید" },
      { code: "visit:delete", label: "حذف بازدید" },
      { code: "notification:read", label: "مشاهده اعلان" },
      { code: "notification:manage", label: "مدیریت اعلان" },
    ],
  },
  {
    key: "deal",
    label: "معاملات و کمیسیون",
    items: [
      { code: "deal:create", label: "ثبت معامله" },
      { code: "deal:read", label: "مشاهده معامله" },
      { code: "deal:update", label: "ویرایش معامله" },
      { code: "deal:delete", label: "حذف معامله" },
      { code: "commission:read", label: "مشاهده کمیسیون" },
      { code: "commission:manage", label: "مدیریت کمیسیون" },
    ],
  },
  {
    key: "ai",
    label: "هوش مصنوعی",
    items: [
      { code: "ai:search", label: "جستجوی هوشمند" },
      { code: "ai:match", label: "تطبیق خودکار" },
      { code: "ai:suggest", label: "پیشنهاد توضیح" },
      { code: "ai:manage", label: "مدیریت AI" },
    ],
  },
  {
    key: "integration",
    label: "یکپارچه‌سازی",
    items: [
      { code: "integration:telegram", label: "تلگرام" },
      { code: "integration:sms", label: "پیامک" },
      { code: "integration:listings", label: "انتشار آگهی" },
      { code: "integration:payment", label: "پرداخت" },
      { code: "integration:maps", label: "نقشه" },
      { code: "integration:logs", label: "مشاهده لاگ‌ها" },
      { code: "integration:manage", label: "مدیریت یکپارچه‌سازی" },
    ],
  },
];

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.code, i.label])),
);

export const INTEGRATION_PROVIDER_META: Record<string, { label: string; hint: string }> = {
  telegram: { label: "تلگرام", hint: "ربات و پیام" },
  sms: { label: "پیامک", hint: "کاوه‌نگار / آزمایشی" },
  divar: { label: "دیوار", hint: "انتشار آگهی" },
  sheypoor: { label: "شیپور", hint: "انتشار آگهی" },
  payment: { label: "پرداخت", hint: "زرین‌پال / آزمایشی" },
  maps: { label: "نقشه", hint: "OpenStreetMap" },
};

export const PROVIDER_NAME_FA: Record<string, string> = {
  mock: "آزمایشی",
  osm: "OpenStreetMap",
  haversine: "محاسبهٔ داخلی",
  telegram: "ربات تلگرام",
  telegram_bot: "ربات تلگرام",
  kavenegar: "کاوه‌نگار",
  zarinpal: "زرین‌پال",
  divar: "دیوار",
  sheypoor: "شیپور",
  openai: "OpenAI",
  gemini: "Gemini",
  claude: "Claude",
  local: "محلی",
};

/** AI engines: "mock" is the real built-in Persian rule-based engine, not a test stub. */
export const AI_PROVIDER_NAME_FA: Record<string, string> = { ...PROVIDER_NAME_FA, mock: "موتور داخلی", local: "مدل محلی" };

export const AI_PROVIDER_TYPE_FA: Record<string, string> = {
  "rule-based": "قانون‌محور",
  llm: "مدل زبانی",
  local_llm: "مدل محلی",
};

export function labelOf<T extends string>(options: Option<T>[], value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label ?? value;
}

export const propertyTypeLabel = (v: string | null | undefined) => labelOf(PROPERTY_TYPES, v);
export const transactionLabel = (v: string | null | undefined) => labelOf(TRANSACTION_TYPES, v);
export const propertyStatusLabel = (v: string | null | undefined) => labelOf(PROPERTY_STATUSES, v);
export const personRoleLabel = (v: string | null | undefined) => labelOf(PERSON_ROLES, v);
export const dealStageLabel = (v: string | null | undefined) =>
  v ? DEAL_STAGES[v as DealStatus]?.label ?? v : "—";
export const roleLabel = (code: string) => SYSTEM_ROLE_LABELS[code] ?? code;
export const cityName = (code: string | null | undefined) => CITIES.find((c) => c.code === code)?.name ?? code ?? "—";
export const districtName = (code: string | null | undefined) =>
  DISTRICTS.find((d) => d.code === code)?.name ?? code ?? "—";

/** Customer request lifecycle (free-form on the backend; these are the values the UI writes). */
export const REQUEST_STATUSES: Record<string, { label: string; tone: Tone }> = {
  active: { label: "فعال", tone: "success" },
  paused: { label: "متوقف", tone: "warning" },
  closed: { label: "بسته‌شده", tone: "neutral" },
};
export const requestStatus = (v: string | null | undefined) =>
  (v && REQUEST_STATUSES[v]) || { label: v ?? "—", tone: "neutral" as Tone };
