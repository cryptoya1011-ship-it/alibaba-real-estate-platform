import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Landmark,
  MapPin,
  Plus,
  Ruler,
  Search,
  Sparkles,
  Star,
  Warehouse,
} from "lucide-react";
import { ApiError, api, addToOutbox } from "../api";
import { cn } from "../lib/cn";
import { faNum, toman, PROPERTY_TYPE_FA, TRANSACTION_TYPE_FA } from "../lib/format";
import type { PropertyListItem } from "../lib/types";
import { useData } from "../state/data";
import { useSession } from "../state/session";
import { Badge, Button, Card, Code, CopyBtn, EmptyState, Field, Input, ListSkeleton, Modal, PageHead, Select, Stat } from "../components/ui";
import { toast } from "sonner";

const TYPE_ICON: Record<string, React.ReactNode> = {
  apartment: <Building2 className="h-4 w-4" />,
  villa: <Warehouse className="h-4 w-4" />,
  land: <MapPin className="h-4 w-4" />,
  commercial: <Landmark className="h-4 w-4" />,
};

type Filters = {
  q: string;
  property_type: string;
  transaction_type: string;
  status: string;
};

export default function PropertiesPage() {
  const { online, refreshOutbox } = useSession();
  const { favorites, reload } = useData();
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ q: "", property_type: "", transaction_type: "", status: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [descFor, setDescFor] = useState<{ code: string; text: string; provider: string } | null>(null);

  const favIds = useMemo(() => new Set(favorites.map((f) => f.property_id)), [favorites]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { limit: 50 };
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.property_type) params.property_type = filters.property_type;
      if (filters.transaction_type) params.transaction_type = filters.transaction_type;
      if (filters.status) params.status = filters.status;
      setItems((await api.listProperties(params)) as PropertyListItem[]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در بارگیری املاک");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
  }, [fetchList]);

  const toggleFavorite = async (propertyId: number) => {
    const isFav = favIds.has(propertyId);
    try {
      if (isFav) await api.removeFavorite(propertyId);
      else await api.addFavorite(propertyId);
      await reload();
      toast.success(isFav ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا");
    }
  };

  const suggestDesc = async (id: number) => {
    const t = toast.loading("در حال تولید توضیح با AI…");
    try {
      const res = await api.aiSuggestDescription(id);
      setDescFor({ code: res.code, text: res.suggested_description, provider: res.provider });
      toast.success("توضیح آماده شد", { id: t });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تولید توضیح", { id: t });
    }
  };

  const totalValue = items.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const forSale = items.filter((p) => p.transaction_type === "sale").length;

  return (
    <div className="animate-fade-in">
      <PageHead
        title="املاک"
        desc={`${faNum(items.length)} ملک — کدگذاری خودکار AB-…`}
        icon={<Building2 className="h-5 w-5" />}
        action={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            className="hidden sm:inline-flex"
          >
            ملک جدید
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="کل املاک" value={faNum(items.length)} icon={<Building2 className="h-4 w-4" />} />
        <Stat label="فروش" value={faNum(forSale)} tone="gold" icon={<Landmark className="h-4 w-4" />} />
        <Stat label="ارزش تقریبی" value={toman(totalValue)} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="جستجو در عنوان، توضیحات یا کد ملک…"
              className="pe-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            <Select value={filters.property_type} onChange={(e) => setFilters({ ...filters, property_type: e.target.value })} className="text-xs">
              <option value="">همه انواع</option>
              <option value="apartment">آپارتمان</option>
              <option value="villa">ویلا</option>
              <option value="land">زمین</option>
              <option value="commercial">تجاری</option>
            </Select>
            <Select value={filters.transaction_type} onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })} className="text-xs">
              <option value="">همه معاملات</option>
              <option value="sale">فروش</option>
              <option value="rent">اجاره</option>
              <option value="exchange">معاوضه</option>
            </Select>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="text-xs">
              <option value="">همه وضعیت‌ها</option>
              <option value="draft">پیش‌نویس</option>
              <option value="active">فعال</option>
              <option value="reserved">رزرو</option>
              <option value="sold">فروخته‌شده</option>
              <option value="published">منتشر شده</option>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="ملکی ثبت نشده"
          desc={filters.q || filters.property_type ? "با این فیلترها ملکی پیدا نشد — فیلترها را تغییر دهید." : "اولین ملک خود را ثبت کنید تا کد یکتای AB-… بگیرد."}
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              ثبت ملک
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${Math.min(i * 35, 300)}ms` }} className="animate-slide-up">
              <Card className="group h-full p-4 transition hover:border-brand/40">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:text-teal-200">
                    {TYPE_ICON[p.property_type] ?? <Building2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">{p.title}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                      <Code>{p.code}</Code>
                      {p.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {p.city} {p.district ? `• ${p.district}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFavorite(p.id)}
                    aria-label="علاقه‌مندی"
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition active:scale-90",
                      favIds.has(p.id) ? "bg-gold/15 text-gold" : "text-muted hover:bg-raise",
                    )}
                  >
                    <Star className={cn("h-4 w-4", favIds.has(p.id) && "fill-current")} />
                  </button>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">{PROPERTY_TYPE_FA[p.property_type] ?? p.property_type}</Badge>
                  {p.transaction_type && <Badge tone="gold">{TRANSACTION_TYPE_FA[p.transaction_type] ?? p.transaction_type}</Badge>}
                  {p.built_area ? (
                    <Badge tone="muted">
                      <Ruler className="h-3 w-3" />
                      {faNum(p.built_area)} م²
                    </Badge>
                  ) : null}
                  {p.status && <Badge tone={p.status === "published" ? "ok" : "muted"}>{p.status}</Badge>}
                </div>

                <div className="tnum mb-3 text-sm font-bold text-brand dark:text-teal-300">{toman(p.price)}</div>

                <div className="flex items-center gap-1 border-t border-line pt-3">
                  <a
                    href={`/p/${p.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[11px] font-medium transition hover:bg-raise"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    صفحه عمومی
                  </a>
                  <CopyBtn text={`${window.location.origin}/p/${p.code}`} label="کپی لینک" />
                  <div className="flex-1" />
                  <Button variant="ghost" size="xs" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => suggestDesc(p.id)}>
                    توضیح AI
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* mobile FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        aria-label="ثبت ملک"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop transition active:scale-95 sm:hidden dark:text-slate-900"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreatePropertyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        online={online}
        onCreated={async () => {
          refreshOutbox();
          await fetchList();
        }}
      />

      <Modal open={!!descFor} onClose={() => setDescFor(null)} title="توضیح پیشنهادی AI">
        {descFor && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted">
              <Code>{descFor.code}</Code>
              <Badge tone="brand">Provider: {descFor.provider}</Badge>
            </div>
            <p className="rounded-xl border border-line bg-raise p-3 text-xs leading-6">{descFor.text}</p>
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(descFor.text);
                    toast.success("توضیح کپی شد");
                  } catch {
                    toast.error("کپی ناموفق بود");
                  }
                }}
              >
                کپی متن
              </Button>
              <Button variant="outline" onClick={() => setDescFor(null)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ── Create property ─────────────────────────────────────────────────── */
function CreatePropertyModal({
  open,
  onClose,
  online,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  online: boolean;
  onCreated: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    title: "",
    property_type: "apartment",
    transaction_type: "sale",
    built_area: 100,
    price: 10_000_000_000,
    city_code: "ISF",
    district_code: "MJ",
    has_parking: true,
    has_elevator: true,
  });
  const [busy, setBusy] = useState(false);

  const buildPayload = () => ({
    title: form.title.trim(),
    property_type: form.property_type,
    transaction_type: form.transaction_type,
    built_area: Number(form.built_area),
    price: Number(form.price),
    has_parking: form.has_parking,
    has_elevator: form.has_elevator,
    owner_name: "مالک تست",
    owner_phone: "09130000000",
    location: { city: "اصفهان", city_code: form.city_code, district: "مرداویج", district_code: form.district_code },
    usages: [{ usage_type: "residential", is_primary: true }],
  });

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("عنوان ملک الزامی است");
      return;
    }
    if (!online) {
      addToOutbox("create_property", buildPayload());
      toast.warning("آفلاین هستید — ملک در صف همگام‌سازی ذخیره شد");
      onClose();
      await onCreated();
      return;
    }
    setBusy(true);
    try {
      const created = await api.createProperty(buildPayload(), `prop-${Date.now()}`);
      toast.success(`ملک ثبت شد — کد ${created.code}`);
      setForm({ ...form, title: "" });
      onClose();
      await onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت ملک");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="ثبت ملک جدید" wide>
      <div className="space-y-4">
        <Field label="عنوان ملک" hint="مثال: آپارتمان ۱۲۰ متری مرداویج با پارکینگ">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان ملک" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع ملک">
            <Select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
              <option value="apartment">آپارتمان</option>
              <option value="villa">ویلا</option>
              <option value="land">زمین</option>
              <option value="commercial">تجاری</option>
            </Select>
          </Field>
          <Field label="نوع معامله">
            <Select value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
              <option value="sale">فروش</option>
              <option value="rent">اجاره</option>
              <option value="exchange">معاوضه</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="متراژ (م²)">
            <Input type="number" value={form.built_area} onChange={(e) => setForm({ ...form, built_area: Number(e.target.value) })} dir="ltr" />
          </Field>
          <Field label="قیمت (تومان)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} dir="ltr" />
          </Field>
        </div>
        <div className="-mt-1 text-[10px] text-muted">معادل: <span className="font-bold text-brand dark:text-teal-300">{toman(form.price)}</span></div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="کد شهر">
            <Input value={form.city_code} onChange={(e) => setForm({ ...form, city_code: e.target.value })} dir="ltr" className="font-mono" />
          </Field>
          <Field label="کد محله">
            <Input value={form.district_code} onChange={(e) => setForm({ ...form, district_code: e.target.value })} dir="ltr" className="font-mono" />
          </Field>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setForm({ ...form, has_parking: !form.has_parking })}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition",
              form.has_parking ? "border-brand/50 bg-brand-soft text-brand dark:text-teal-200" : "border-line text-muted",
            )}
          >
            {form.has_parking && <CheckCircle2 className="h-3.5 w-3.5" />}
            پارکینگ
          </button>
          <button
            onClick={() => setForm({ ...form, has_elevator: !form.has_elevator })}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition",
              form.has_elevator ? "border-brand/50 bg-brand-soft text-brand dark:text-teal-200" : "border-line text-muted",
            )}
          >
            {form.has_elevator && <CheckCircle2 className="h-3.5 w-3.5" />}
            آسانسور
          </button>
        </div>

        <Button className="w-full" size="lg" loading={busy} onClick={submit}>
          {online ? "ثبت ملک — کد AB-…" : "ذخیره آفلاین در صف"}
        </Button>
      </div>
    </Modal>
  );
}
