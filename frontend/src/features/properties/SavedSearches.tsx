import { useState } from "react";
import { Bookmark, BookmarkPlus, ListChecks, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { useApi, invalidate } from "@/hooks/useApi";
import type { SavedSearch, SavedSearchMatch } from "@/lib/types";
import { CITIES, propertyStatusLabel, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Code } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";

export type SearchQuery = {
  q?: string;
  status?: string;
  property_type?: string;
  transaction_type?: string;
  city_code?: string;
  min_price?: number;
  max_price?: number;
  rooms?: number;
  has_parking?: boolean;
  has_elevator?: boolean;
};

export function parseQuery(s: SavedSearch): SearchQuery {
  try {
    const raw: unknown = JSON.parse(s.query_json ?? "{}");
    return raw && typeof raw === "object" ? (raw as SearchQuery) : {};
  } catch {
    return {};
  }
}

export function describeQuery(q: SearchQuery): string[] {
  const parts: string[] = [];
  if (q.property_type) parts.push(propertyTypeLabel(q.property_type));
  if (q.transaction_type) parts.push(transactionLabel(q.transaction_type));
  if (q.status) parts.push(propertyStatusLabel(q.status));
  if (q.city_code) parts.push(CITIES.find((c) => c.code === q.city_code)?.name ?? q.city_code);
  if (q.min_price) parts.push(`از ${compactToman(q.min_price)}`);
  if (q.max_price) parts.push(`تا ${compactToman(q.max_price)}`);
  if (q.rooms) parts.push(`${faNum(q.rooms)} اتاق`);
  if (q.has_parking) parts.push("پارکینگ");
  if (q.has_elevator) parts.push("آسانسور");
  if (q.q) parts.push(`«${q.q}»`);
  return parts;
}

/** Saved searches: save current filters, apply one, see its matches, toggle, delete. */
export function SavedSearchesDialog({
  open,
  onOpenChange,
  current,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: SearchQuery;
  onApply: (q: SearchQuery) => void;
}) {
  const confirm = useConfirm();
  const { data, error, loading, reload, setData } = useApi(() => api.listSavedSearches(), [], { enabled: open, keys: ["saved-searches"] });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<{ search: SavedSearch; items: SavedSearchMatch[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const currentParts = describeQuery(current);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("یک نام کوتاه برای جستجو بنویسید");
      return;
    }
    setSaving(true);
    try {
      const query: Record<string, unknown> = {};
      Object.entries(current).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== false) query[k] = v;
      });
      await api.createSavedSearch({ name: trimmed, query, is_active: true });
      toast.success("جستجو ذخیره شد");
      setName("");
      invalidate("saved-searches");
    } catch (err) {
      toast.error(errorMessage(err, "ذخیره جستجو ناموفق بود"));
    } finally {
      setSaving(false);
    }
  };

  const showMatches = async (s: SavedSearch) => {
    setBusy(s.id);
    try {
      setMatches({ search: s, items: await api.listSavedSearchMatches(s.id, { limit: 50 }) });
    } catch (err) {
      toast.error(errorMessage(err, "دریافت نتایج ناموفق بود"));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (s: SavedSearch, isActive: boolean) => {
    setBusy(s.id);
    try {
      const version = s.version ?? (await api.getSavedSearch(s.id)).version ?? 1;
      const updated = await api.updateSavedSearch(s.id, { is_active: isActive, version });
      setData((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, is_active: isActive, version: updated.version } : x)));
      toast.success(isActive ? "اعلان این جستجو فعال شد" : "این جستجو غیرفعال شد");
    } catch (err) {
      toast.error(errorMessage(err, "تغییر وضعیت ناموفق بود"));
      void reload();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s: SavedSearch) => {
    const yes = await confirm({ title: "حذف جستجوی ذخیره‌شده؟", description: `«${s.name}» حذف می‌شود.`, confirmLabel: "حذف", destructive: true });
    if (!yes) return;
    setBusy(s.id);
    try {
      await api.deleteSavedSearch(s.id);
      setData((prev) => (prev ?? []).filter((x) => x.id !== s.id));
      toast.success("جستجو حذف شد");
    } catch (err) {
      toast.error(errorMessage(err, "حذف ناموفق بود"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="جستجوهای ذخیره‌شده" description="فیلترهای پرکاربرد را ذخیره کنید و با یک لمس دوباره اجرا کنید" size="lg">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 rounded-[16px] bg-card-2 p-3.5 hairline">
            <p className="flex items-center gap-2 text-caption font-semibold">
              <BookmarkPlus className="size-4 text-primary" aria-hidden /> ذخیره فیلتر فعلی
            </p>
            <div className="flex flex-wrap gap-1.5">
              {currentParts.length ? (
                currentParts.map((p) => (
                  <Badge key={p} tone="primary">
                    {p}
                  </Badge>
                ))
              ) : (
                <span className="text-caption text-muted-foreground">هنوز فیلتری انتخاب نشده (همه املاک)</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="نام جستجو"
                placeholder="مثلاً آپارتمان‌های فروشی زیر ۱۰ میلیارد"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                className="flex-1"
              />
              <Button onClick={save} loading={saving}>
                ذخیره
              </Button>
            </div>
          </div>

          {loading ? (
            <ListSkeleton count={3} />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !data?.length ? (
            <EmptyState icon={Bookmark} title="جستجوی ذخیره‌شده‌ای ندارید" description="فیلترها را تنظیم کنید و با یک نام ذخیره کنید." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.map((s) => {
                const q = parseQuery(s);
                return (
                  <li key={s.id} className="flex flex-col gap-2 rounded-[14px] bg-card p-3 hairline">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-semibold">{s.name}</p>
                      <Switch checked={s.is_active !== false} onCheckedChange={(v) => void toggle(s, v)} disabled={busy === s.id} aria-label={`فعال بودن ${s.name}`} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {describeQuery(q).map((p) => (
                        <Badge key={p}>{p}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          onApply(q);
                          onOpenChange(false);
                        }}
                      >
                        <Play aria-hidden /> اعمال فیلتر
                      </Button>
                      <Button size="sm" variant="soft" onClick={() => void showMatches(s)} loading={busy === s.id && !matches}>
                        <ListChecks aria-hidden /> نتایج
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void remove(s)} aria-label={`حذف ${s.name}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    {matches?.search.id === s.id && (
                      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                        <p className="text-caption text-muted-foreground">{faNum(matches.items.length)} ملک منطبق</p>
                        {matches.items.slice(0, 8).map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-caption">
                            <Code>{m.code}</Code>
                            <span className="min-w-0 flex-1 truncate">{m.title}</span>
                            <span className="tnum text-muted-foreground">{compactToman(m.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
