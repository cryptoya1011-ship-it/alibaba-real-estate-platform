import { useMemo, useState } from "react";
import { Bell, BellOff, Building2, CheckCheck, Star, Trash2 } from "lucide-react";
import { ApiError, api } from "../api";
import { cn } from "../lib/cn";
import { faDateTime, faNum, toman } from "../lib/format";
import { useData } from "../state/data";
import { Badge, Button, Card, Code, EmptyState, ListSkeleton, PageHead, Stat } from "../components/ui";
import { toast } from "sonner";

/* ── Favorites ───────────────────────────────────────────────────────── */
export function FavoritesPage() {
  const { favorites, properties, reload, loading } = useData();
  const [removing, setRemoving] = useState<number | null>(null);

  const propMap = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const remove = async (propertyId: number) => {
    setRemoving(propertyId);
    try {
      await api.removeFavorite(propertyId);
      toast.success("از علاقه‌مندی‌ها حذف شد");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا");
    } finally {
      setRemoving(null);
    }
  };

  const total = favorites.reduce((sum, f) => sum + (propMap.get(f.property_id)?.price ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <PageHead title="علاقه‌مندی‌ها" desc="املاک نشان‌شده برای پیگیری سریع" icon={<Star className="h-5 w-5" />} />

      {favorites.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Stat label="تعداد" value={faNum(favorites.length)} icon={<Star className="h-4 w-4" />} tone="gold" />
          <Stat label="ارزش مجموع" value={toman(total)} tone="ok" />
        </div>
      )}

      {loading && favorites.length === 0 ? (
        <ListSkeleton />
      ) : favorites.length === 0 ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="لیست علاقه‌مندی خالی است" desc="با زدن ستاره روی هر ملک، آن را اینجا نگه دارید." />
      ) : (
        <ul className="space-y-2">
          {favorites.map((f) => {
            const p = propMap.get(f.property_id);
            return (
              <li key={f.id} className="animate-slide-up">
                <Card className="flex items-center gap-3 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{p?.title ?? `ملک #${f.property_id}`}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                      {p?.code && <Code>{p.code}</Code>}
                      <span className="tnum">{toman(p?.price)}</span>
                    </div>
                  </div>
                  {p?.code && (
                    <a href={`/p/${p.code}`} target="_blank" rel="noreferrer" className="text-[10px] text-brand hover:underline dark:text-teal-300">
                      مشاهده
                    </a>
                  )}
                  <button
                    onClick={() => remove(f.property_id)}
                    disabled={removing === f.property_id}
                    aria-label="حذف از علاقه‌مندی"
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Notifications ───────────────────────────────────────────────────── */
const PRIORITY_TONE: Record<string, "danger" | "warn" | "brand" | "muted"> = {
  critical: "danger",
  important: "warn",
  normal: "brand",
  low: "muted",
};

export function NotificationsPage() {
  const { notifications, unreadCount, reload, loading } = useData();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const list = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  const markAll = async () => {
    setBusy(true);
    try {
      await api.markAllNotificationsRead();
      toast.success("همه اعلان‌ها خوانده شدند");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا");
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHead
        title="اعلان‌ها"
        desc={unreadCount > 0 ? `${faNum(unreadCount)} اعلان خوانده‌نشده` : "همه اعلان‌ها خوانده شده‌اند"}
        icon={<Bell className="h-5 w-5" />}
        action={
          <Button size="sm" variant="outline" icon={<CheckCheck className="h-3.5 w-3.5" />} loading={busy} onClick={markAll} disabled={unreadCount === 0}>
            خواندن همه
          </Button>
        }
      />

      <div className="mb-4 flex gap-1.5">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-[11px] font-medium transition",
              filter === f ? "bg-brand text-white dark:text-slate-900" : "bg-raise text-muted hover:text-ink",
            )}
          >
            {f === "all" ? `همه (${faNum(notifications.length)})` : `خوانده‌نشده (${faNum(unreadCount)})`}
          </button>
        ))}
      </div>

      {loading && notifications.length === 0 ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-6 w-6" />}
          title={filter === "unread" ? "اعلان خوانده‌نشده‌ای نیست" : "اعلان‌ای وجود ندارد"}
          desc="با ثبت بازدید یا تغییر وضعیت معامله، اعلان ساخته می‌شود."
        />
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id} className="animate-slide-up">
              <Card
                className={cn("p-3.5 transition", !n.is_read && "border-brand/40 bg-brand-soft/30")}
                onClick={() => !n.is_read && markOne(n.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      n.is_read ? "bg-raise text-muted" : "bg-brand/15 text-brand dark:text-teal-300",
                    )}
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold">{n.title}</span>
                      <Badge tone={PRIORITY_TONE[n.priority] ?? "muted"}>{n.priority}</Badge>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </div>
                    {n.body && <p className="mt-1 text-[11px] leading-5 text-muted">{n.body}</p>}
                    {n.created_at && <div className="mt-1.5 text-[9px] text-muted">{faDateTime(n.created_at)}</div>}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
