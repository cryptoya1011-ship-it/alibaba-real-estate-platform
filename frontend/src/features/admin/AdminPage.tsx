import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building, Building2, CalendarClock, ChevronLeft, Crown, GitBranch, Handshake, RotateCw, ShieldCheck, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/hooks/useSession";
import type { AdminGlobalStats, AdminOrgStats, AdminUser, Organization } from "@/lib/types";
import { faNum, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { Avatar, Code, PageHeader, StatCard, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";

type Tab = "overview" | "orgs" | "users";

const STAT_META: { key: keyof AdminGlobalStats; label: string; icon: LucideIcon; tone: "primary" | "accent" | "info" | "success" | "warning" | "danger" }[] = [
  { key: "organizations", label: "سازمان‌ها", icon: Building, tone: "primary" },
  { key: "users", label: "کاربران", icon: UserRound, tone: "accent" },
  { key: "branches", label: "شعب", icon: GitBranch, tone: "info" },
  { key: "properties", label: "املاک", icon: Building2, tone: "success" },
  { key: "persons", label: "مشتریان", icon: Users, tone: "warning" },
  { key: "visits", label: "بازدیدها", icon: CalendarClock, tone: "info" },
  { key: "deals", label: "معاملات", icon: Handshake, tone: "primary" },
];

const CHART_COLORS = ["var(--primary)", "var(--accent)", "var(--info)", "var(--success)", "var(--warning)", "var(--danger)", "var(--primary-strong)"];

const tooltipProps = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border-strong)",
    borderRadius: 12,
    color: "var(--foreground)",
    fontFamily: "inherit",
    direction: "rtl" as const,
  },
  itemStyle: { color: "var(--foreground)" },
  labelStyle: { color: "var(--muted-foreground)" },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
  formatter: (v: unknown) => faNum(Number(v)),
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader icon={Crown} title="مدیریت کل" description="آمار سراسری، سازمان‌ها و کاربران پلتفرم" />
      <Segmented<Tab>
        aria-label="بخش‌های مدیریت"
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "نمای کلی" },
          { value: "orgs", label: "سازمان‌ها" },
          { value: "users", label: "کاربران" },
        ]}
      />
      {tab === "overview" && <Overview />}
      {tab === "orgs" && <Orgs />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

function Overview() {
  const { data, error, loading, reload, refreshing } = useApi(() => api.adminGlobalStats(), [], { keys: ["admin"] });
  const chartData = useMemo(() => (data ? STAT_META.filter((m) => m.key !== "organizations" && m.key !== "users").map((m) => ({ name: m.label, value: data[m.key] })) : []), [data]);
  const pieData = useMemo(
    () => (data ? [{ name: "املاک", value: data.properties }, { name: "مشتریان", value: data.persons }, { name: "بازدیدها", value: data.visits }, { name: "معاملات", value: data.deals }].filter((d) => d.value > 0) : []),
    [data],
  );

  if (loading)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
          <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden /> بروزرسانی
        </Button>
      </div>
      <StaggerList as="div" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAT_META.map((m) => (
          <StaggerItem as="div" key={m.key}>
            <StatCard label={m.label} value={faNum(data[m.key])} icon={m.icon} tone={m.tone} />
          </StaggerItem>
        ))}
      </StaggerList>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>حجم داده عملیاتی</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} reversed />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v: number) => faNum(v)} orientation="right" />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="value" name="تعداد" radius={[8, 8, 0, 0]} maxBarSize={44}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ترکیب فعالیت</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="py-10 text-center text-body text-muted-foreground">هنوز داده‌ای نیست</p>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={3} stroke="none">
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipProps} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-1.5 text-caption">
                  {pieData.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${["bg-primary", "bg-accent", "bg-info", "bg-success"][i % 4]}`} aria-hidden />
                      {d.name}
                      <span className="tnum ms-auto font-semibold">{faNum(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Orgs() {
  const [q, setQ] = useState("");
  const { data, error, loading, reload, refreshing } = useApi(() => api.adminListOrgs({ limit: 100 }), [], { keys: ["admin"] });
  const [selected, setSelected] = useState<Organization | null>(null);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((o) => !t || o.name.toLowerCase().includes(t) || o.slug.toLowerCase().includes(t));
  }, [data, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="جستجوی نام یا شناسه سازمان…" className="flex-1" />
        <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
          <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
        </Button>
      </div>
      {loading ? (
        <RowSkeleton count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={Building} title="سازمانی پیدا نشد" />
      ) : (
        <StaggerList className="grid gap-2 md:grid-cols-2">
          {list.map((o) => (
            <StaggerItem key={o.id}>
              <button
                type="button"
                onClick={() => setSelected(o)}
                className="flex w-full items-center gap-3 rounded-[14px] bg-card p-3.5 text-start shadow-sm transition hairline hover:border-border-strong"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-primary-soft text-primary">
                  <Building className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.name}</span>
                  <span className="flex items-center gap-2 text-caption text-muted-foreground">
                    <Code>{o.slug}</Code>
                    {o.created_at && <span>{formatDate(o.created_at)}</span>}
                  </span>
                </span>
                {o.is_active === false && <Badge tone="danger">غیرفعال</Badge>}
                <ChevronLeft className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent title={selected.name} description={<Code>{selected.slug}</Code>} size="lg">
            <OrgStats orgId={selected.id} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

const ORG_STAT_META: { key: keyof AdminOrgStats; label: string; icon: LucideIcon; tone: "primary" | "accent" | "info" | "success" | "warning" | "danger" }[] = [
  { key: "members_count", label: "اعضا", icon: Users, tone: "accent" },
  { key: "branches_count", label: "شعب", icon: GitBranch, tone: "info" },
  { key: "properties_count", label: "املاک", icon: Building2, tone: "success" },
  { key: "persons_count", label: "مشتریان", icon: UserRound, tone: "warning" },
  { key: "visits_count", label: "بازدیدها", icon: CalendarClock, tone: "info" },
  { key: "deals_count", label: "معاملات", icon: Handshake, tone: "primary" },
];

function OrgStats({ orgId }: { orgId: number }) {
  const { data, error, loading, reload } = useApi(() => api.adminGetOrgStats(orgId), [orgId]);
  if (loading)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const chart = ORG_STAT_META.map((m) => ({ name: m.label, value: Number(data[m.key] ?? 0) }));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ORG_STAT_META.map((m) => (
          <StatCard key={m.key} label={m.label} value={faNum(Number(data[m.key] ?? 0))} icon={m.icon} tone={m.tone} />
        ))}
      </div>
      <div className="h-52" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => faNum(v)} reversed />
            <YAxis type="category" dataKey="name" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="value" name="تعداد" fill="var(--primary)" radius={[8, 0, 0, 8]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function userName(u: AdminUser) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || `کاربر ${faNum(u.id)}`;
}

function UsersTab() {
  const { session, logout } = useSession();
  const { data, error, loading, reload, refreshing, setData } = useApi(() => api.adminListUsers({ limit: 100 }), [], { keys: ["admin"] });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const confirm = useConfirm();
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((u) => !t || userName(u).toLowerCase().includes(t) || String(u.telegram_id ?? "").includes(t) || (u.phone ?? "").includes(t));
  }, [data, q]);

  const toggle = async (u: AdminUser, next: boolean) => {
    const self = u.id === session?.user.id;
    const ok = await confirm({
      title: next ? `ارتقای «${userName(u)}» به سوپر ادمین؟` : `لغو دسترسی سوپر ادمین «${userName(u)}»؟`,
      description: self
        ? "این حساب خودتان است؛ پس از تغییر، نشست فعلی نامعتبر می‌شود و باید دوباره وارد شوید."
        : next
          ? "این کاربر به همه سازمان‌ها و داده‌های پلتفرم دسترسی کامل خواهد داشت."
          : "کاربر دیگر به بخش مدیریت کل دسترسی نخواهد داشت.",
      confirmLabel: next ? "ارتقا" : "لغو دسترسی",
      destructive: !next || self,
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      const updated = await api.adminToggleSuperAdmin(u.id, next);
      setData((prev) => (prev ?? []).map((x) => (x.id === u.id ? { ...x, ...(updated ?? {}), is_super_admin: next } : x)));
      toast.success(next ? "کاربر سوپر ادمین شد" : "دسترسی سوپر ادمین لغو شد");
      if (self) {
        toast.info("نشست شما منقضی شد؛ دوباره وارد شوید");
        logout();
      }
    } catch (err) {
      toast.error(errorMessage(err, "تغییر دسترسی ناموفق بود"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="جستجوی نام، شناسه تلگرام یا موبایل…" className="flex-1" />
        <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
          <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
        </Button>
      </div>
      {loading ? (
        <RowSkeleton count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={UserRound} title="کاربری پیدا نشد" />
      ) : (
        <StaggerList className="flex flex-col gap-2">
          {list.map((u) => {
            const id = `sa-${u.id}`;
            return (
              <StaggerItem key={u.id} className="flex items-center gap-3 rounded-[14px] bg-card p-3 shadow-sm hairline">
                <Avatar name={userName(u)} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {userName(u)}
                    {u.id === session?.user.id && <Badge tone="info">شما</Badge>}
                    {u.is_super_admin && (
                      <Badge tone="accent">
                        <ShieldCheck className="size-3" aria-hidden /> سوپر ادمین
                      </Badge>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                    {u.telegram_id ? <Code>{String(u.telegram_id)}</Code> : null}
                    {u.phone ? <Code>{u.phone}</Code> : null}
                    {u.created_at && <span>{formatDate(u.created_at)}</span>}
                  </p>
                </div>
                <label htmlFor={id} className="sr-only">
                  سوپر ادمین {userName(u)}
                </label>
                <Switch id={id} checked={u.is_super_admin} disabled={busy === u.id} onCheckedChange={(v) => toggle(u, v)} aria-label={`سوپر ادمین ${userName(u)}`} />
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}
