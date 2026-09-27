import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Bell, Building2, CalendarClock, CloudUpload, Handshake, Plus, Sparkles, UserPlus, Users } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/hooks/useSession";
import { useOutbox } from "@/hooks/useOutbox";
import { useOnline } from "@/hooks/useOnline";
import { useUnread } from "@/hooks/useUnread";
import { DEAL_STAGES, roleLabel } from "@/lib/constants";
import type { DealStatus } from "@/lib/types";
import { compactToman, faNum, formatTime, formatWeekdayDate, todayISO } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, StatCard } from "@/components/ui/misc";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/cn";

const CLOSED = new Set(["closed_won", "closed_lost", "archived"]);

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "روز بخیر";
  return "عصر بخیر";
}

const QUICK: { to: string; label: string; icon: LucideIcon; tone: string }[] = [
  { to: "/app/properties?new=1", label: "ثبت ملک", icon: Building2, tone: "bg-primary-soft text-primary" },
  { to: "/app/crm?new=1", label: "مشتری جدید", icon: UserPlus, tone: "bg-accent-soft text-accent" },
  { to: "/app/visits?new=1", label: "بازدید جدید", icon: CalendarClock, tone: "bg-info-soft text-info" },
  { to: "/app/deals?new=1", label: "معامله جدید", icon: Handshake, tone: "bg-success-soft text-success" },
];

export default function DashboardPage() {
  const { session, currentOrg } = useSession();
  const { unread } = useUnread();
  const outbox = useOutbox();
  const online = useOnline();
  const props = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties", "dashboard"] });
  const persons = useApi(() => api.listPersons({ limit: 100 }), [], { keys: ["persons", "dashboard"] });
  const visits = useApi(() => api.listVisits({ limit: 100 }), [], { keys: ["visits", "dashboard"] });
  const deals = useApi(() => api.listDeals({ limit: 100 }), [], { keys: ["deals", "dashboard"] });
  const today = todayISO();

  const upcoming = useMemo(
    () =>
      (visits.data ?? [])
        .filter((v) => v.visit_date >= today)
        .sort((a, b) => (a.visit_date + (a.visit_time ?? "")).localeCompare(b.visit_date + (b.visit_time ?? "")))
        .slice(0, 5),
    [visits.data, today],
  );
  const todayCount = (visits.data ?? []).filter((v) => v.visit_date === today).length;
  const activeDeals = (deals.data ?? []).filter((d) => !CLOSED.has(d.status));
  const pipeline = activeDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const byStage = useMemo(() => {
    const m = new Map<string, number>();
    activeDeals.forEach((d) => m.set(d.status, (m.get(d.status) ?? 0) + 1));
    return [...m.entries()];
  }, [activeDeals]);
  const propName = (id: number) => props.data?.find((p) => p.id === id)?.title ?? `ملک #${faNum(id)}`;
  const personName = (id: number) => persons.data?.find((p) => p.id === id)?.display_name ?? `مشتری #${faNum(id)}`;
  const loadingStats = props.loading || persons.loading || visits.loading || deals.loading;

  return (
    <div className="flex flex-col gap-6">
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-[20px] bg-card p-5 hairline shadow-sm md:p-6"
      >
        <div aria-hidden className="bg-hero pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="text-body text-muted-foreground">{formatWeekdayDate(new Date())}</p>
            <h1 className="text-display font-extrabold tracking-tight md:text-display-lg">
              {greeting()}، {session?.user.display_name ?? "همکار"}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-body text-muted-foreground">
              {currentOrg?.name}
              {currentOrg && <Code>{currentOrg.slug}</Code>}
              {session?.roles.map((r) => (
                <Badge key={r} tone="primary">
                  {roleLabel(r)}
                </Badge>
              ))}
            </p>
          </div>
          <Link to="/app/ai" className={buttonVariants({ variant: "accent" })}>
            <Sparkles aria-hidden /> دستیار هوشمند
          </Link>
        </div>
      </motion.section>

      {outbox.count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-warning-soft p-4 hairline">
          <CloudUpload className="size-5 text-warning" aria-hidden />
          <p className="flex-1 text-body">
            <b className="tnum">{faNum(outbox.count)}</b> ملک آفلاین در صف ارسال است.
          </p>
          <Button size="sm" onClick={outbox.sync} loading={outbox.syncing} disabled={!online}>
            همگام‌سازی
          </Button>
        </div>
      )}

      <section aria-label="میانبرها" className="grid grid-cols-4 gap-2 sm:gap-3">
        {QUICK.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex flex-col items-center gap-2 rounded-[16px] bg-card p-3 text-center text-caption font-semibold shadow-sm transition hairline hover:border-border-strong hover:shadow-md sm:flex-row sm:p-4 sm:text-body"
          >
            <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-[14px]", q.tone)}>
              <q.icon className="size-5" aria-hidden />
              <Plus className="absolute -end-1 -top-1 size-4 rounded-full bg-card p-0.5 text-foreground" aria-hidden />
            </span>
            {q.label}
          </Link>
        ))}
      </section>

      {loadingStats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : props.error ? (
        <ErrorState error={props.error} onRetry={props.reload} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="املاک" value={props.data?.length ?? 0} icon={Building2} hint={`${faNum((props.data ?? []).filter((p) => p.status === "published").length)} منتشرشده`} />
          <StatCard label="مشتریان" value={persons.data?.length ?? 0} icon={Users} tone="accent" />
          <StatCard label="بازدید امروز" value={todayCount} icon={CalendarClock} tone="info" hint={`${faNum(upcoming.length)} پیش رو`} />
          <StatCard label="معاملات فعال" value={activeDeals.length} icon={Handshake} tone="success" hint={compactToman(pipeline, "بدون مبلغ")} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>بازدیدهای پیش رو</CardTitle>
            <Link to="/app/visits" className="inline-flex items-center gap-1 text-caption font-semibold text-primary">
              همه <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {visits.loading ? (
              <RowSkeleton count={3} />
            ) : visits.error ? (
              <ErrorState error={visits.error} onRetry={visits.reload} />
            ) : upcoming.length === 0 ? (
              <p className="py-6 text-center text-body text-muted-foreground">بازدید برنامه‌ریزی‌شده‌ای ندارید.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {upcoming.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn("tnum grid size-11 shrink-0 place-items-center rounded-[12px] text-caption font-bold", v.visit_date === today ? "bg-gradient-primary text-primary-foreground" : "bg-muted")}>
                      {formatTime(v.visit_time, "—")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{propName(v.property_id)}</span>
                      <span className="block truncate text-caption text-muted-foreground">
                        {personName(v.customer_id)} · {v.visit_date === today ? "امروز" : formatWeekdayDate(v.visit_date)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>قیف معاملات</CardTitle>
            <Link to="/app/deals" className="inline-flex items-center gap-1 text-caption font-semibold text-primary">
              همه <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {deals.loading ? (
              <RowSkeleton count={3} />
            ) : deals.error ? (
              <ErrorState error={deals.error} onRetry={deals.reload} />
            ) : byStage.length === 0 ? (
              <p className="py-6 text-center text-body text-muted-foreground">معامله فعالی ندارید.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {byStage.map(([st, n]) => {
                  const meta = DEAL_STAGES[st as DealStatus] ?? { label: st, tone: "neutral" as const };
                  return (
                    <li key={st} className="flex items-center gap-3">
                      <Badge tone={meta.tone} className="w-24 justify-center">
                        {meta.label}
                      </Badge>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <motion.div
                          className="h-full rounded-full bg-gradient-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${(n / activeDeals.length) * 100}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="tnum w-8 text-end font-semibold">{faNum(n)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {unread > 0 && (
        <Link
          to="/app/notifications"
          className="flex items-center gap-3 rounded-[16px] bg-primary-soft p-4 transition hairline hover:border-primary/50"
        >
          <Bell className="size-5 text-primary" aria-hidden />
          <span className="flex-1 text-body">
            <b className="tnum">{faNum(unread)}</b> اعلان خوانده‌نشده دارید
          </span>
          <ArrowLeft className="size-4 text-primary" aria-hidden />
        </Link>
      )}
    </div>
  );
}
