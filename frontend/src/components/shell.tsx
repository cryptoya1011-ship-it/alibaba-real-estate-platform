import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  Crown,
  Download,
  Globe,
  Handshake,
  LayoutGrid,
  Moon,
  Package,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useSession } from "../state/session";
import { useData } from "../state/data";
import { useTheme } from "../state/theme";
import { Badge, Button, Field, Input, Logo, Modal } from "./ui";
import { faNum } from "../lib/format";

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean; superOnly?: boolean };

const PRIMARY: NavItem[] = [
  { to: "/", label: "املاک", icon: <Building2 className="h-5 w-5" />, end: true },
  { to: "/crm", label: "مشتریان", icon: <Users className="h-5 w-5" /> },
  { to: "/visits", label: "بازدیدها", icon: <CalendarDays className="h-5 w-5" /> },
  { to: "/deals", label: "معاملات", icon: <Handshake className="h-5 w-5" /> },
];

export function Shell({ children }: { children: ReactNode }) {
  const { session, online, outboxCount, updateAvailable, installPrompt, isInstalled, syncOutbox } = useSession();
  const { unreadCount } = useData();
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const navigate = useNavigate();

  const moreItems: NavItem[] = [
    { to: "/favorites", label: "علاقه‌مندی‌ها", icon: <Star className="h-5 w-5" /> },
    { to: "/public", label: "پلتفرم عمومی", icon: <Globe className="h-5 w-5" /> },
    { to: "/team", label: "تیم و دعوت‌ها", icon: <UserPlus className="h-5 w-5" /> },
    { to: "/roles", label: "نقش‌ها و مجوزها", icon: <ShieldCheck className="h-5 w-5" /> },
    { to: "/ai", label: "هوش مصنوعی", icon: <Sparkles className="h-5 w-5" /> },
    { to: "/integrations", label: "یکپارچه‌سازی", icon: <Plug className="h-5 w-5" /> },
    ...(session?.user.is_super_admin ? [{ to: "/admin", label: "سوپر ادمین", icon: <Crown className="h-5 w-5" />, superOnly: true }] : []),
  ];

  const currentOrg = session?.organizations.find((o) => o.id === session.organization_id);

  return (
    <div className="min-h-dvh">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 md:px-6">
          <button className="flex items-center gap-2.5" onClick={() => navigate("/")}>
            <Logo size="sm" />
            <div className="text-start leading-tight">
              <div className="text-[13px] font-bold">املاک علی‌بابا</div>
              <div className="text-[9px] text-muted">AREP — Local-First PWA</div>
            </div>
          </button>

          <div className="flex-1" />

          {/* online dot */}
          <span
            className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium", online ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger")}
            title={online ? "آنلاین" : "آفلاین"}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{online ? "آنلاین" : "آفلاین"}</span>
          </span>

          {outboxCount > 0 && (
            <button
              onClick={syncOutbox}
              className="flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-medium text-warn transition hover:brightness-110"
              title="همگام‌سازی صف آفلاین"
            >
              <Package className="h-3 w-3" />
              <span className="tnum">{faNum(outboxCount)}</span>
            </button>
          )}

          {installPrompt && !isInstalled && (
            <button onClick={installPrompt} className="hidden items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-medium text-brand sm:flex dark:text-teal-200">
              <Download className="h-3 w-3" /> نصب اپ
            </button>
          )}

          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-raise hover:text-ink"
            aria-label="تغییر تم"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              cn(
                "relative flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-raise",
                isActive ? "text-brand" : "text-muted hover:text-ink",
              )
            }
            aria-label="اعلان‌ها"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="tnum absolute -top-0.5 -start-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                {faNum(unreadCount)}
              </span>
            )}
          </NavLink>

          <button
            onClick={() => setOrgOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[11px] font-medium transition hover:bg-raise"
          >
            <Building2 className="h-3.5 w-3.5 text-brand" />
            <span className="max-w-24 truncate">{currentOrg ? currentOrg.name : "انتخاب سازمان"}</span>
          </button>
        </div>
      </header>

      {/* ── Banners ── */}
      {!online && (
        <div className="border-b border-danger/20 bg-danger/10 px-4 py-2 text-center text-[11px] font-medium text-danger animate-fade-in">
          آفلاین هستید — تغییرات در صف همگام‌سازی (Outbox) ذخیره می‌شوند
        </div>
      )}
      {updateAvailable && (
        <div className="flex items-center justify-center gap-3 border-b border-brand/20 bg-brand-soft px-4 py-2 text-[11px] font-medium text-brand animate-fade-in dark:text-teal-200">
          نسخه جدید اپ آماده است
          <button onClick={() => window.location.reload()} className="rounded-lg bg-brand px-2.5 py-1 text-[10px] font-bold text-white dark:text-slate-900">
            به‌روزرسانی
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="mx-auto flex max-w-6xl">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-e border-line p-3 lg:flex">
          <SideLink to="/" label="املاک" icon={<Building2 className="h-4 w-4" />} end />
          <SideLink to="/crm" label="مشتریان" icon={<Users className="h-4 w-4" />} />
          <SideLink to="/visits" label="بازدیدها" icon={<CalendarDays className="h-4 w-4" />} />
          <SideLink to="/deals" label="معاملات" icon={<Handshake className="h-4 w-4" />} />
          <div className="my-2 border-t border-line" />
          {moreItems.map((m) => (
            <SideLink key={m.to} to={m.to} label={m.label} icon={m.icon} />
          ))}
          <div className="my-2 border-t border-line" />
          <SideLink to="/notifications" label="اعلان‌ها" icon={<Bell className="h-4 w-4" />} badge={unreadCount} />
          <div className="mt-auto rounded-xl bg-raise p-3 text-[9px] leading-4 text-muted">
            ایزولیشن ۴ لایه tenant — Context → Repository → RLS → Cache
            <br />
            دسترسی به tenant دیگر → ۴۴
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-6 lg:pb-10">{children}</main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-5 pb-safe">
          {PRIMARY.map((item) => (
            <MobileLink key={item.to} item={item} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-muted transition active:scale-95"
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[9px] font-medium">بیشتر</span>
          </button>
        </div>
      </nav>

      {/* ── More sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm animate-fade-in lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-3xl border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-sheet-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">منوی کامل</span>
              <button onClick={() => setMoreOpen(false)} className="text-muted" aria-label="بستن">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-[10px] font-medium transition",
                      isActive ? "border-brand/40 bg-brand-soft text-brand dark:text-teal-200" : "border-line bg-raise text-muted hover:text-ink",
                    )
                  }
                >
                  {m.icon}
                  {m.label}
                </NavLink>
              ))}
              <NavLink
                to="/notifications"
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-raise p-3.5 text-[10px] font-medium text-muted transition hover:text-ink"
              >
                <Bell className="h-5 w-5" />
                اعلان‌ها
              </NavLink>
            </div>
          </div>
        </div>
      )}

      <OrgSwitcher open={orgOpen} onClose={() => setOrgOpen(false)} />
    </div>
  );
}

function SideLink({ to, label, icon, end, badge }: { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
          isActive ? "bg-brand-soft text-brand dark:bg-teal-900/40 dark:text-teal-200" : "text-muted hover:bg-raise hover:text-ink",
        )
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? <Badge tone="danger">{faNum(badge)}</Badge> : null}
    </NavLink>
  );
}

function MobileLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn("flex flex-col items-center justify-center gap-1 py-2.5 transition active:scale-95", isActive ? "text-brand" : "text-muted")
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn("rounded-xl px-3 py-0.5 transition-colors", isActive && "bg-brand-soft dark:bg-teal-900/40")}>{item.icon}</span>
          <span className="text-[9px] font-medium">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/* ── Org switcher ── */
function OrgSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, chooseOrganization, createOrganization } = useSession();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  if (!session) return null;

  return (
    <Modal open={open} onClose={onClose} title="سازمان‌ها — Tenant Isolation">
      <div className="space-y-2">
        {session.organizations.map((org) => (
          <button
            key={org.id}
            onClick={async () => {
              await chooseOrganization(org.id);
              onClose();
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-3 text-start transition",
              session.organization_id === org.id ? "border-brand/50 bg-brand-soft" : "border-line bg-raise hover:bg-surface",
            )}
          >
            <div>
              <div className="text-xs font-bold">{org.name}</div>
              <div className="ltr mt-0.5 font-mono text-[9px] text-muted" dir="ltr">
                {org.slug}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {org.is_owner && <Badge tone="gold">مالک</Badge>}
              {session.organization_id === org.id && <Badge tone="brand">فعال ✓</Badge>}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {!creating ? (
          <Button variant="soft" className="w-full" icon={<Building2 className="h-4 w-4" />} onClick={() => setCreating(true)}>
            ساخت سازمان جدید
          </Button>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <Field label="نام سازمان">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="املاک علی‌بابا اصفهان" />
            </Field>
            <Field label="شناسه انگلیسی (slug)" hint="حروف انگلیسی و خط تیره — در کد ملک استفاده می‌شود">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="alibaba-isf" dir="ltr" className="font-mono text-xs" />
            </Field>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                loading={busy}
                onClick={async () => {
                  if (!name.trim() || !slug.trim()) return;
                  setBusy(true);
                  const ok = await createOrganization(name.trim(), slug.trim());
                  setBusy(false);
                  if (ok) {
                    setName("");
                    setSlug("");
                    setCreating(false);
                    onClose();
                  }
                }}
              >
                ثبت سازمان
              </Button>
              <Button variant="outline" onClick={() => setCreating(false)}>
                انصراف
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 text-[9px] leading-4 text-muted">
        ایزولیشن: Context → Repository → RLS (Postgres) → Cache — دسترسی به tenant دیگر ۴۰۴ برمی‌گرداند (نه ۴۰۳)
      </p>
    </Modal>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="outline" size="sm" icon={<RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />} onClick={onClick}>
      تازه‌سازی
    </Button>
  );
}
