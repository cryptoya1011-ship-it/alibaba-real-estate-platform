import { useCallback, useEffect, useState } from "react";
import { Building2, Crown, Handshake, HardHat, Home, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ApiError, api } from "../api";
import { faNum } from "../lib/format";
import { useSession } from "../state/session";
import { Badge, Button, Card, Code, EmptyState, ListSkeleton, PageHead, Stat, Switch } from "../components/ui";
import { toast } from "sonner";

type Org = { id: number; name: string; slug: string; city_code?: string | null; is_active: boolean };
type User = { id: number; first_name: string; last_name?: string | null; telegram_id: number; phone?: string | null; is_super_admin: boolean };
type OrgStats = {
  members_count: number;
  branches_count: number;
  properties_count: number;
  persons_count: number;
  visits_count: number;
  deals_count: number;
};
type GlobalStats = {
  organizations: number;
  users: number;
  branches: number;
  properties: number;
  persons: number;
  visits: number;
  deals: number;
};

const CHART_COLORS = ["#0d9488", "#14b8a6", "#c9a84c", "#2dd4bf", "#f59e0b"];

export default function AdminPage() {
  const { session } = useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [orgStats, setOrgStats] = useState<Record<number, OrgStats>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.is_super_admin) return;
    setLoading(true);
    try {
      const [orgList, userList, globalStats] = await Promise.all([api.adminListOrgs({ limit: 50 }), api.adminListUsers({ limit: 50 }), api.adminGlobalStats()]);
      setOrgs(orgList as Org[]);
      setUsers(userList as User[]);
      setStats(globalStats as GlobalStats);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در بارگیری داده ادمین");
    } finally {
      setLoading(false);
    }
  }, [session?.user.is_super_admin]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOrgStats = async (orgId: number) => {
    try {
      const s = (await api.adminGetOrgStats(orgId)) as OrgStats;
      setOrgStats((prev) => ({ ...prev, [orgId]: s }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در آمار سازمان");
    }
  };

  const toggleSuper = async (u: User) => {
    setToggling(u.id);
    try {
      await api.adminToggleSuperAdmin(u.id, !u.is_super_admin);
      toast.success(u.is_super_admin ? "دسترسی سوپر ادمین گرفته شد" : "کاربر سوپر ادمین شد");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا");
    } finally {
      setToggling(null);
    }
  };

  if (!session?.user.is_super_admin) {
    return <EmptyState icon={<Crown className="h-6 w-6" />} title="دسترسی محدود" desc="این بخش فقط برای سوپر ادمین‌ها قابل مشاهده است." />;
  }

  const entityChart = stats
    ? [
        { name: "املاک", value: stats.properties },
        { name: "مشتریان", value: stats.persons },
        { name: "بازدیدها", value: stats.visits },
        { name: "معاملات", value: stats.deals },
      ]
    : [];

  const orgChart = Object.entries(orgStats).slice(0, 6).map(([id, s]) => ({
    name: `#${id}`,
    "املاک": s.properties_count,
    "مشتریان": s.persons_count,
  }));

  return (
    <div className="animate-fade-in">
      <PageHead
        title="سوپر ادمین"
        desc="نمای سراسری همه سازمان‌ها — دسترسی از طریق get_db_public (بای‌پس RLS)"
        icon={<Crown className="h-5 w-5" />}
        action={
          <Button size="sm" variant="outline" onClick={load}>
            تازه‌سازی
          </Button>
        }
      />

      {loading && !stats ? (
        <ListSkeleton />
      ) : (
        <>
          {stats && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="سازمان‌ها" value={faNum(stats.organizations)} icon={<Building2 className="h-4 w-4" />} />
              <Stat label="کاربران" value={faNum(stats.users)} tone="gold" icon={<Users className="h-4 w-4" />} />
              <Stat label="شعب" value={faNum(stats.branches)} tone="muted" icon={<Home className="h-4 w-4" />} />
              <Stat label="املاک" value={faNum(stats.properties)} tone="ok" icon={<HardHat className="h-4 w-4" />} />
              <Stat label="مشتریان" value={faNum(stats.persons)} icon={<Users className="h-4 w-4" />} />
              <Stat label="بازدیدها" value={faNum(stats.visits)} tone="warn" icon={<Home className="h-4 w-4" />} />
              <Stat label="معاملات" value={faNum(stats.deals)} tone="danger" icon={<Handshake className="h-4 w-4" />} />
              <Stat label="میانگین ملک/سازمان" value={faNum(stats.organizations ? Math.round(stats.properties / stats.organizations) : 0)} tone="muted" />
            </div>
          )}

          {/* Charts */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-bold">توزیع موجودیت‌ها در کل پلتفرم</h2>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={entityChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgb(var(--c-muted))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgb(var(--c-muted))" }} />
                    <Tooltip
                      contentStyle={{ background: "rgb(var(--c-surface))", border: "1px solid rgb(var(--c-line))", borderRadius: 12, fontSize: 11 }}
                      labelStyle={{ color: "rgb(var(--c-ink))" }}
                    />
                    <Bar dataKey="value" name="تعداد" radius={[8, 8, 0, 0]}>
                      {entityChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-bold">سهم موجودیت‌ها</h2>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={entityChart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                      {entityChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10, color: "rgb(var(--c-muted))" }} />
                    <Tooltip
                      contentStyle={{ background: "rgb(var(--c-surface))", border: "1px solid rgb(var(--c-line))", borderRadius: 12, fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {orgChart.length > 0 && (
            <Card className="mb-4 p-4">
              <h2 className="mb-3 text-sm font-bold">مقایسه سازمان‌های بررسی‌شده</h2>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orgChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgb(var(--c-muted))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgb(var(--c-muted))" }} />
                    <Tooltip contentStyle={{ background: "rgb(var(--c-surface))", border: "1px solid rgb(var(--c-line))", borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="املاک" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="مشتریان" fill="#c9a84c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Organizations */}
          <Card className="mb-4 p-4">
            <h2 className="mb-3 text-sm font-bold">سازمان‌ها ({faNum(orgs.length)})</h2>
            <ul className="space-y-2">
              {orgs.map((org) => (
                <li key={org.id} className="rounded-xl border border-line bg-raise/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{org.name}</span>
                        <Code>{org.slug}</Code>
                        <Badge tone={org.is_active ? "ok" : "danger"}>{org.is_active ? "فعال" : "غیرفعال"}</Badge>
                      </div>
                      <div className="mt-1 text-[10px] text-muted">
                        شناسه #{faNum(org.id)} {org.city_code ? `— شهر ${org.city_code}` : ""}
                      </div>
                    </div>
                    <Button size="xs" variant="outline" onClick={() => loadOrgStats(org.id)}>
                      مشاهده آمار
                    </Button>
                  </div>
                  {orgStats[org.id] && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center animate-fade-in sm:grid-cols-6">
                      {[
                        ["اعضا", orgStats[org.id].members_count],
                        ["شعب", orgStats[org.id].branches_count],
                        ["املاک", orgStats[org.id].properties_count],
                        ["مشتریان", orgStats[org.id].persons_count],
                        ["بازدید", orgStats[org.id].visits_count],
                        ["معامله", orgStats[org.id].deals_count],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg bg-surface p-2">
                          <div className="tnum text-sm font-bold">{faNum(Number(value))}</div>
                          <div className="text-[9px] text-muted">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* Users */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold">کاربران ({faNum(users.length)})</h2>
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-raise text-[11px] font-bold">
                      {(u.first_name || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {u.first_name} {u.last_name ?? ""}
                        {u.is_super_admin && <Crown className="h-3.5 w-3.5 text-gold" />}
                      </div>
                      <div className="ltr tnum mt-0.5 font-mono text-[9px] text-muted" dir="ltr">
                        tg:{u.telegram_id} {u.phone ? `• ${u.phone}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">سوپر ادمین</span>
                    <Switch on={u.is_super_admin} onChange={() => !toggling && toggleSuper(u)} label="تغییر دسترسی سوپر ادمین" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
