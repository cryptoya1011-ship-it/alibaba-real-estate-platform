import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  CalendarClock,
  Crown,
  Globe,
  Handshake,
  LayoutDashboard,
  Plug,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";

export type NavItem = {
  key: string;
  to: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  group: "main" | "smart" | "org" | "other" | "admin";
  mobilePrimary?: boolean;
  superAdminOnly?: boolean;
  end?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "home", to: "/app", label: "داشبورد", short: "خانه", icon: LayoutDashboard, group: "main", mobilePrimary: true, end: true },
  { key: "properties", to: "/app/properties", label: "املاک", icon: Building2, group: "main", mobilePrimary: true },
  { key: "crm", to: "/app/crm", label: "مشتریان", icon: Users, group: "main", mobilePrimary: true },
  { key: "visits", to: "/app/visits", label: "بازدیدها", short: "بازدید", icon: CalendarClock, group: "main", mobilePrimary: true },
  { key: "deals", to: "/app/deals", label: "معاملات", icon: Handshake, group: "main", mobilePrimary: true },
  { key: "ai", to: "/app/ai", label: "دستیار هوشمند", short: "هوش مصنوعی", icon: Sparkles, group: "smart" },
  { key: "integrations", to: "/app/integrations", label: "یکپارچه‌سازی", icon: Plug, group: "smart" },
  { key: "team", to: "/app/team", label: "تیم و سازمان", short: "تیم", icon: UserPlus, group: "org" },
  { key: "roles", to: "/app/roles", label: "نقش‌ها و دسترسی", short: "نقش‌ها", icon: ShieldCheck, group: "org" },
  { key: "public", to: "/app/public", label: "ویترین عمومی", short: "عمومی", icon: Globe, group: "other" },
  { key: "favorites", to: "/app/favorites", label: "علاقه‌مندی‌ها", icon: Star, group: "other" },
  { key: "notifications", to: "/app/notifications", label: "اعلان‌ها", icon: Bell, group: "other" },
  { key: "admin", to: "/app/admin", label: "مدیریت کل", short: "ادمین", icon: Crown, group: "admin", superAdminOnly: true },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "main", label: "کار روزانه" },
  { key: "smart", label: "هوشمند" },
  { key: "org", label: "سازمان" },
  { key: "other", label: "بیشتر" },
  { key: "admin", label: "سوپر ادمین" },
];

export function visibleNav(isSuperAdmin: boolean) {
  return NAV_ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin);
}
