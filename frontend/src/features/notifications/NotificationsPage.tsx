import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, BellOff, CalendarClock, CheckCheck, Handshake, Building2, RotateCw, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useUnread } from "@/hooks/useUnread";
import type { NotificationItem } from "@/lib/types";
import { NOTIFICATION_PRIORITY } from "@/lib/constants";
import { faNum, formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/tabs";
import { PageHeader, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";

const ENTITY_ICON: Record<string, LucideIcon> = { visit: CalendarClock, deal: Handshake, property: Building2 };
const ENTITY_ROUTE: Record<string, string> = { visit: "/app/visits", deal: "/app/deals", property: "/app/properties" };

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, loading, reload, refreshing, setData } = useApi(() => api.listNotifications({ limit: 100 }), [], { keys: ["notifications"] });
  const { unread, setUnread, refresh } = useUnread();
  const [marking, setMarking] = useState(false);
  const navigate = useNavigate();

  const unreadCount = useMemo(() => (data ?? []).filter((n) => !n.is_read).length, [data]);
  const visible = useMemo(() => (filter === "unread" ? (data ?? []).filter((n) => !n.is_read) : data ?? []), [data, filter]);

  const markAll = async () => {
    const prev = data;
    setData((data ?? []).map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    setMarking(true);
    try {
      await api.markAllNotificationsRead();
      toast.success("همه اعلان‌ها خوانده شدند");
    } catch (err) {
      if (prev) setData(prev);
      refresh();
      toast.error(errorMessage(err, "علامت‌گذاری ناموفق بود"));
    } finally {
      setMarking(false);
    }
  };

  const open = async (n: NotificationItem) => {
    if (!n.is_read) {
      setData((data ?? []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread(Math.max(0, unread - 1));
      api.markNotificationRead(n.id).catch(() => {
        invalidate("notifications");
      });
    }
    const route = n.entity_type ? ENTITY_ROUTE[n.entity_type] : undefined;
    if (route) navigate(route);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Bell}
        title="اعلان‌ها"
        description={unreadCount ? `${faNum(unreadCount)} اعلان خوانده‌نشده` : "همه چیز خوانده شده"}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
              <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button variant="secondary" onClick={markAll} disabled={unreadCount === 0} loading={marking}>
              <CheckCheck aria-hidden /> خواندن همه
            </Button>
          </>
        }
      />
      <Segmented<Filter>
        aria-label="فیلتر اعلان‌ها"
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: "همه", count: data?.length },
          { value: "unread", label: "خوانده‌نشده", count: unreadCount },
        ]}
      />
      {loading ? (
        <RowSkeleton count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === "unread" ? "اعلان خوانده‌نشده‌ای ندارید" : "هنوز اعلانی نیست"}
          description="با ثبت بازدید، تغییر مرحله معامله و رویدادهای مهم، اعلان‌ها اینجا ظاهر می‌شوند."
        />
      ) : (
        <StaggerList className="flex flex-col gap-2">
          {visible.map((n) => {
            const Icon = (n.entity_type && ENTITY_ICON[n.entity_type]) || Info;
            const pr = NOTIFICATION_PRIORITY[n.priority];
            return (
              <StaggerItem key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    "relative flex w-full items-start gap-3 rounded-[14px] p-3.5 text-start transition hairline",
                    n.is_read ? "bg-card hover:bg-card-2" : "border-primary/40 bg-primary-soft hover:border-primary/60",
                  )}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px]", n.is_read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("flex-1 truncate", n.is_read ? "font-medium" : "font-bold")}>{n.title}</span>
                      {pr && n.priority !== "normal" && <Badge tone={pr.tone}>{pr.label}</Badge>}
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-body text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-caption text-muted-foreground" title={formatDateTime(n.created_at)}>
                      {relativeTime(n.created_at)}
                    </span>
                  </span>
                  {!n.is_read && (
                    <>
                      <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="sr-only">خوانده‌نشده</span>
                    </>
                  )}
                </button>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}
