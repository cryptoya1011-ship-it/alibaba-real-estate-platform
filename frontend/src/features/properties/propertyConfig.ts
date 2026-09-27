/**
 * Which fields a property form shows depends on the property type and the
 * transaction type. Hidden fields are sent as null so switching type never
 * leaves stale data behind (e.g. a sale price on a rental).
 */
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpFromLine,
  Bath,
  BellRing,
  Camera,
  Car,
  Droplets,
  Dumbbell,
  Fence,
  FileCheck2,
  Flame,
  Hammer,
  Handshake,
  KeyRound,
  Landmark,
  Package,
  PlugZap,
  Presentation,
  ShieldCheck,
  Snowflake,
  Sofa,
  Sparkles,
  Store,
  Sun,
  Thermometer,
  TreeDeciduous,
  Trees,
  Truck,
  Tv,
  Waves,
  Wind,
  Wrench,
} from "lucide-react";
import type { RegistrantType } from "@/lib/types";

export type AreaField = "land_area" | "built_area" | "useful_area" | "floor_area";
export type SpecField = "rooms" | "bedrooms" | "bathrooms" | "floor_number" | "total_floors" | "year_built";
export type CoreFeature = "has_parking" | "has_elevator" | "has_warehouse" | "has_balcony";
export type AmenityGroup = "residential" | "building" | "comfort" | "commercial" | "land" | "industrial" | "legal";

export type TypeConfig = {
  areas: AreaField[];
  /** The area that must be filled in for this type. */
  requiredArea: AreaField;
  specs: SpecField[];
  core: CoreFeature[];
  groups: AmenityGroup[];
};

const RESIDENTIAL_GROUPS: AmenityGroup[] = ["residential", "building", "comfort", "legal"];

export const TYPE_CONFIG: Record<string, TypeConfig> = {
  apartment: {
    areas: ["built_area", "useful_area"],
    requiredArea: "built_area",
    specs: ["rooms", "bedrooms", "bathrooms", "floor_number", "total_floors", "year_built"],
    core: ["has_parking", "has_elevator", "has_warehouse", "has_balcony"],
    groups: RESIDENTIAL_GROUPS,
  },
  residential: {
    areas: ["land_area", "built_area"],
    requiredArea: "built_area",
    specs: ["rooms", "bedrooms", "bathrooms", "total_floors", "year_built"],
    core: ["has_parking", "has_elevator", "has_warehouse", "has_balcony"],
    groups: RESIDENTIAL_GROUPS,
  },
  villa: {
    areas: ["land_area", "built_area"],
    requiredArea: "land_area",
    specs: ["rooms", "bedrooms", "bathrooms", "total_floors", "year_built"],
    core: ["has_parking", "has_warehouse", "has_balcony"],
    groups: ["residential", "comfort", "land", "legal"],
  },
  garden: {
    areas: ["land_area", "built_area"],
    requiredArea: "land_area",
    specs: ["rooms", "year_built"],
    core: ["has_parking", "has_warehouse"],
    groups: ["land", "legal"],
  },
  land: {
    areas: ["land_area"],
    requiredArea: "land_area",
    specs: [],
    core: [],
    groups: ["land", "legal"],
  },
  commercial: {
    areas: ["built_area", "useful_area", "floor_area"],
    requiredArea: "built_area",
    specs: ["floor_number", "year_built"],
    core: ["has_parking", "has_warehouse"],
    groups: ["commercial", "building", "legal"],
  },
  office: {
    areas: ["built_area", "useful_area"],
    requiredArea: "built_area",
    specs: ["rooms", "bathrooms", "floor_number", "total_floors", "year_built"],
    core: ["has_parking", "has_elevator", "has_warehouse", "has_balcony"],
    groups: ["commercial", "building", "comfort", "legal"],
  },
  administrative: {
    areas: ["built_area", "useful_area"],
    requiredArea: "built_area",
    specs: ["rooms", "bathrooms", "floor_number", "total_floors", "year_built"],
    core: ["has_parking", "has_elevator", "has_warehouse", "has_balcony"],
    groups: ["commercial", "building", "comfort", "legal"],
  },
  industrial: {
    areas: ["land_area", "built_area"],
    requiredArea: "land_area",
    specs: ["year_built"],
    core: ["has_parking", "has_warehouse"],
    groups: ["industrial", "land", "legal"],
  },
  mixed_use: {
    areas: ["land_area", "built_area", "useful_area"],
    requiredArea: "built_area",
    specs: ["rooms", "floor_number", "total_floors", "year_built"],
    core: ["has_parking", "has_elevator", "has_warehouse", "has_balcony"],
    groups: ["residential", "commercial", "building", "legal"],
  },
};

export const typeConfig = (type: string): TypeConfig => TYPE_CONFIG[type] ?? TYPE_CONFIG.apartment;

export const AREA_LABELS: Record<AreaField, string> = {
  land_area: "متراژ زمین (متر)",
  built_area: "متراژ بنا (متر)",
  useful_area: "متراژ مفید (متر)",
  floor_area: "متراژ کف / دهنه (متر)",
};

export const SPEC_LABELS: Record<SpecField, string> = {
  rooms: "تعداد اتاق",
  bedrooms: "اتاق خواب",
  bathrooms: "سرویس بهداشتی",
  floor_number: "طبقه",
  total_floors: "تعداد کل طبقات",
  year_built: "سال ساخت (شمسی)",
};

export const CORE_FEATURES: { key: CoreFeature; label: string; icon: LucideIcon }[] = [
  { key: "has_parking", label: "پارکینگ", icon: Car },
  { key: "has_elevator", label: "آسانسور", icon: ArrowUpFromLine },
  { key: "has_warehouse", label: "انباری", icon: Package },
  { key: "has_balcony", label: "بالکن", icon: Sun },
];

export type Amenity = { key: string; label: string; icon: LucideIcon; group: AmenityGroup };

/** Extra amenities, stored in the property's `amenities` JSON object as {key: true}. */
export const AMENITIES: Amenity[] = [
  // Residential unit
  { key: "master_bedroom", label: "اتاق مستر", icon: Bath, group: "residential" },
  { key: "open_kitchen", label: "آشپزخانه اپن", icon: Sparkles, group: "residential" },
  { key: "furnished", label: "مبله", icon: Sofa, group: "residential" },
  { key: "renovated", label: "بازسازی‌شده", icon: Hammer, group: "residential" },
  { key: "roof_garden", label: "روف‌گاردن", icon: Trees, group: "residential" },
  { key: "pool", label: "استخر", icon: Waves, group: "residential" },
  { key: "sauna_jacuzzi", label: "سونا و جکوزی", icon: Droplets, group: "residential" },
  { key: "gym", label: "سالن ورزش", icon: Dumbbell, group: "residential" },
  // Building
  { key: "lobby", label: "لابی", icon: Landmark, group: "building" },
  { key: "concierge", label: "نگهبان / سرایدار", icon: ShieldCheck, group: "building" },
  { key: "cctv", label: "دوربین مداربسته", icon: Camera, group: "building" },
  { key: "video_intercom", label: "آیفون تصویری", icon: Tv, group: "building" },
  { key: "remote_door", label: "درب ریموت", icon: KeyRound, group: "building" },
  { key: "fire_alarm", label: "اعلام و اطفای حریق", icon: BellRing, group: "building" },
  { key: "backup_power", label: "برق اضطراری", icon: PlugZap, group: "building" },
  { key: "meeting_hall", label: "سالن اجتماعات", icon: Presentation, group: "building" },
  // Heating / cooling
  { key: "package_heater", label: "پکیج", icon: Flame, group: "comfort" },
  { key: "central_heating", label: "شوفاژ / موتورخانه", icon: Thermometer, group: "comfort" },
  { key: "floor_heating", label: "گرمایش از کف", icon: Thermometer, group: "comfort" },
  { key: "split_ac", label: "اسپلیت / داکت اسپلیت", icon: Snowflake, group: "comfort" },
  { key: "evaporative_cooler", label: "کولر آبی", icon: Wind, group: "comfort" },
  // Commercial
  { key: "main_street", label: "بر خیابان اصلی", icon: Store, group: "commercial" },
  { key: "mezzanine", label: "بالکن تجاری / نیم‌طبقه", icon: ArrowUpFromLine, group: "commercial" },
  { key: "signage", label: "تابلوخور", icon: Presentation, group: "commercial" },
  { key: "private_wc", label: "سرویس بهداشتی اختصاصی", icon: Bath, group: "commercial" },
  { key: "three_phase_power", label: "برق سه‌فاز", icon: PlugZap, group: "commercial" },
  // Land / garden
  { key: "water_well", label: "چاه آب", icon: Droplets, group: "land" },
  { key: "water_share", label: "حقابه", icon: Waves, group: "land" },
  { key: "fenced", label: "دیوارکشی / فنس", icon: Fence, group: "land" },
  { key: "fruit_trees", label: "درختان مثمر", icon: TreeDeciduous, group: "land" },
  { key: "utilities", label: "انشعاب آب، برق و گاز", icon: PlugZap, group: "land" },
  { key: "building_permit", label: "جواز ساخت", icon: FileCheck2, group: "land" },
  // Industrial
  { key: "overhead_crane", label: "جرثقیل سقفی", icon: Wrench, group: "industrial" },
  { key: "loading_dock", label: "رمپ بارگیری", icon: Truck, group: "industrial" },
  { key: "industrial_power", label: "برق صنعتی", icon: PlugZap, group: "industrial" },
  // Legal / financial
  { key: "single_deed", label: "سند تک‌برگ", icon: FileCheck2, group: "legal" },
  { key: "has_loan", label: "دارای وام", icon: Landmark, group: "legal" },
  { key: "negotiable", label: "قابل مذاکره", icon: Handshake, group: "legal" },
];

export const AMENITY_GROUP_LABELS: Record<AmenityGroup, string> = {
  residential: "واحد",
  building: "ساختمان و امنیت",
  comfort: "سرمایش و گرمایش",
  commercial: "تجاری / اداری",
  land: "زمین و باغ",
  industrial: "صنعتی",
  legal: "حقوقی و مالی",
};

export const amenityLabel = (key: string) => AMENITIES.find((a) => a.key === key)?.label ?? key;

export function parseAmenities(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: Record<string, boolean> = {};
    Object.entries(data as Record<string, unknown>).forEach(([k, v]) => {
      if (v === true) out[k] = true;
    });
    return out;
  } catch {
    return {};
  }
}

export const REGISTRANT_TYPES: { value: RegistrantType; label: string }[] = [
  { value: "agent", label: "مشاور املاک" },
  { value: "office_staff", label: "کارمند دفتر" },
  { value: "owner", label: "خود مالک" },
  { value: "intermediary", label: "واسطه" },
];

export const PRICE_LABEL: Record<string, string> = {
  sale: "قیمت کل (تومان)",
  exchange: "ارزش تقریبی (تومان)",
};

export const USAGE_BY_TYPE: Record<string, string> = {
  commercial: "commercial",
  office: "office",
  administrative: "administrative",
  industrial: "industrial",
  garden: "garden",
};
