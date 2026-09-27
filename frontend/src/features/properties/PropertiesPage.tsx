import { useMemo, useState, type ReactNode } from "react";
import { Bookmark, Building2, Car, ArrowUpFromLine, Plus, RotateCw, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useMisc";
import { useCreateParam } from "@/hooks/useCreateParam";
import { CITIES, PROPERTY_STATUSES, PROPERTY_TYPES, TRANSACTION_TYPES } from "@/lib/constants";
import { compactToman, faNum, parseNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader, StaggerItem, StaggerList } from "@/components/ui/misc";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Fab } from "@/components/ui/fab";
import { useFavorites } from "@/features/favorites/useFavorites";
import { PropertyCard } from "./PropertyCard";
import { PropertyForm } from "./PropertyForm";
import { PropertyDetailDialog } from "./PropertyDetailDialog";
import { SavedSearchesDialog, type SearchQuery } from "./SavedSearches";

const ALL = "all";

function ToggleChip({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-[12px] border px-3 text-caption font-medium transition-colors [&_svg]:size-4",
        on ? "border-primary bg-primary-soft text-primary" : "border-input bg-card-2 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export default function PropertiesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [transaction, setTransaction] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rooms, setRooms] = useState(ALL);
  const [parking, setParking] = useState(false);
  const [elevator, setElevator] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useCreateParam();
  const [detail, setDetail] = useState<{ id: number; suggest: boolean } | null>(null);
  const dq = useDebounced(q, 300);
  const dMin = useDebounced(minPrice, 400);
  const dMax = useDebounced(maxPrice, 400);

  const query = useMemo<SearchQuery>(
    () => ({
      q: dq.trim() || undefined,
      status: status === ALL ? undefined : status,
      property_type: type === ALL ? undefined : type,
      transaction_type: transaction === ALL ? undefined : transaction,
      city_code: city === ALL ? undefined : city,
      min_price: parseNumber(dMin) ?? undefined,
      max_price: parseNumber(dMax) ?? undefined,
      rooms: rooms === ALL ? undefined : Number(rooms),
      has_parking: parking || undefined,
      has_elevator: elevator || undefined,
    }),
    [dq, status, type, transaction, city, dMin, dMax, rooms, parking, elevator],
  );
  const params = useMemo(() => ({ limit: 50, ...query }), [query]);

  const { data, error, loading, reload, refreshing } = useApi(() => api.listProperties(params), [params], { keys: ["properties"] });
  const favorites = useFavorites();
  const activeFilters =
    [status, type, transaction, city, rooms].filter((v) => v !== ALL).length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (parking ? 1 : 0) +
    (elevator ? 1 : 0);

  const applyQuery = (sq: SearchQuery) => {
    setQ(sq.q ?? "");
    setStatus(sq.status ?? ALL);
    setType(sq.property_type ?? ALL);
    setTransaction(sq.transaction_type ?? ALL);
    setCity(sq.city_code ?? ALL);
    setMinPrice(sq.min_price ? String(sq.min_price) : "");
    setMaxPrice(sq.max_price ? String(sq.max_price) : "");
    setRooms(sq.rooms ? String(sq.rooms) : ALL);
    setParking(!!sq.has_parking);
    setElevator(!!sq.has_elevator);
    setShowFilters(true);
  };
  const clearFilters = () => applyQuery({});

  const filters = (
    <>
      <Select
        aria-label="وضعیت"
        value={status}
        onValueChange={setStatus}
        options={[{ value: ALL, label: "همه وضعیت‌ها" }, ...PROPERTY_STATUSES]}
      />
      <Select aria-label="نوع ملک" value={type} onValueChange={setType} options={[{ value: ALL, label: "همه انواع" }, ...PROPERTY_TYPES]} />
      <Select
        aria-label="نوع معامله"
        value={transaction}
        onValueChange={setTransaction}
        options={[{ value: ALL, label: "همه معاملات" }, ...TRANSACTION_TYPES]}
      />
      <Select
        aria-label="شهر"
        value={city}
        onValueChange={setCity}
        options={[{ value: ALL, label: "همه شهرها" }, ...CITIES.map((c) => ({ value: c.code, label: c.name }))]}
      />
      <div className="relative">
        <Input aria-label="حداقل قیمت (تومان)" inputMode="numeric" className="tnum" placeholder="حداقل قیمت" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        {minPrice && <span className="tnum pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{compactToman(parseNumber(minPrice))}</span>}
      </div>
      <div className="relative">
        <Input aria-label="حداکثر قیمت (تومان)" inputMode="numeric" className="tnum" placeholder="حداکثر قیمت" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        {maxPrice && <span className="tnum pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{compactToman(parseNumber(maxPrice))}</span>}
      </div>
      <Select
        aria-label="تعداد اتاق"
        value={rooms}
        onValueChange={setRooms}
        options={[{ value: ALL, label: "تعداد اتاق" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${faNum(n)} اتاق` }))]}
      />
      <div className="grid grid-cols-2 gap-2">
        <ToggleChip on={parking} onClick={() => setParking((v) => !v)} icon={<Car aria-hidden />} label="پارکینگ" />
        <ToggleChip on={elevator} onClick={() => setElevator((v) => !v)} icon={<ArrowUpFromLine aria-hidden />} label="آسانسور" />
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Building2}
        title="املاک"
        description={data ? `${faNum(data.length)} ملک${activeFilters || dq ? " مطابق فیلتر" : ""}` : "فایل‌های ملکی سازمان"}
        actions={
          <>
            <Button variant="secondary" size="icon" onClick={() => setSavedOpen(true)} aria-label="جستجوهای ذخیره‌شده" title="جستجوهای ذخیره‌شده">
              <Bookmark aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
              <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> ثبت ملک
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="جستجو در عنوان، توضیحات یا کد…" className="flex-1" />
          <Button
            variant={activeFilters ? "soft" : "secondary"}
            size="icon"
            className="relative"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-label="فیلترها"
          >
            <SlidersHorizontal aria-hidden />
            {activeFilters > 0 && (
              <span className="tnum absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {faNum(activeFilters)}
              </span>
            )}
          </Button>
        </div>
        <div className={showFilters ? "grid grid-cols-2 gap-2 md:grid-cols-4" : "hidden"}>{filters}</div>
        {activeFilters > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X aria-hidden /> پاک کردن فیلترها
            </Button>
            <Button size="sm" variant="soft" onClick={() => setSavedOpen(true)}>
              <Bookmark aria-hidden /> ذخیره این جستجو
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <ListSkeleton count={6} media grid />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={activeFilters || dq ? "ملکی با این فیلتر پیدا نشد" : "هنوز ملکی ثبت نشده"}
          description={activeFilters || dq ? "فیلترها یا عبارت جستجو را تغییر دهید." : "اولین فایل ملکی را ثبت کنید تا کد اختصاصی و لینک عمومی بگیرد."}
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> ثبت ملک
            </Button>
          }
        />
      ) : (
        <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <StaggerItem key={p.id}>
              <PropertyCard
                property={p}
                favorite={favorites.ids.has(p.id)}
                onToggleFavorite={() => favorites.toggle(p.id)}
                onOpen={() => setDetail({ id: p.id, suggest: false })}
                onSuggest={() => setDetail({ id: p.id, suggest: true })}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <Fab label="ثبت ملک" onClick={() => setCreateOpen(true)} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="ثبت ملک جدید" description="کد اختصاصی AB-… پس از ثبت ساخته می‌شود" size="lg">
          <PropertyForm
            onDone={(created) => {
              setCreateOpen(false);
              if (created) setDetail({ id: created.id, suggest: false });
            }}
          />
        </DialogContent>
      </Dialog>

      <SavedSearchesDialog open={savedOpen} onOpenChange={setSavedOpen} current={query} onApply={applyQuery} />

      <PropertyDetailDialog
        propertyId={detail?.id ?? null}
        autoSuggest={detail?.suggest}
        onOpenChange={(o) => !o && setDetail(null)}
        favorite={detail ? favorites.ids.has(detail.id) : false}
        onToggleFavorite={() => detail && favorites.toggle(detail.id)}
      />
    </div>
  );
}
