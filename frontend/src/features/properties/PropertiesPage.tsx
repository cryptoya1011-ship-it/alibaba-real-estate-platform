import { useMemo, useState } from "react";
import { Building2, Plus, RotateCw, SlidersHorizontal } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useMisc";
import { useCreateParam } from "@/hooks/useCreateParam";
import { PROPERTY_STATUSES, PROPERTY_TYPES, TRANSACTION_TYPES } from "@/lib/constants";
import { faNum } from "@/lib/format";
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

const ALL = "all";

export default function PropertiesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [transaction, setTransaction] = useState(ALL);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useCreateParam();
  const [detail, setDetail] = useState<{ id: number; suggest: boolean } | null>(null);
  const dq = useDebounced(q, 300);

  const params = useMemo(
    () => ({
      limit: 50,
      q: dq.trim() || undefined,
      status: status === ALL ? undefined : status,
      property_type: type === ALL ? undefined : type,
      transaction_type: transaction === ALL ? undefined : transaction,
    }),
    [dq, status, type, transaction],
  );

  const { data, error, loading, reload, refreshing } = useApi(() => api.listProperties(params), [params], { keys: ["properties"] });
  const favorites = useFavorites();
  const activeFilters = [status, type, transaction].filter((v) => v !== ALL).length;

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
            className="relative md:hidden"
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
        <div className={showFilters ? "grid grid-cols-1 gap-2 sm:grid-cols-3" : "hidden gap-2 md:grid md:grid-cols-3"}>{filters}</div>
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
          <PropertyForm onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

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
