import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Globe, MapPin, Ruler, RotateCw } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useMisc";
import type { PublicProperty } from "@/lib/types";
import { CITIES, PROPERTY_TYPES, TRANSACTION_TYPES, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Code, CopyButton, PageHeader, StaggerItem, StaggerList } from "@/components/ui/misc";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PropertyVisual } from "@/features/properties/PropertyVisual";
import { publicUrl } from "@/features/properties/PropertyCard";

const ALL = "all";

export default function PublicListPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState(ALL);
  const [transaction, setTransaction] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const dq = useDebounced(q, 300);
  const params = useMemo(
    () => ({
      limit: 40,
      q: dq.trim() || undefined,
      property_type: type === ALL ? undefined : type,
      transaction_type: transaction === ALL ? undefined : transaction,
      city_code: city === ALL ? undefined : city,
    }),
    [dq, type, transaction, city],
  );
  const { data, error, loading, reload, refreshing } = useApi(() => api.publicListProperties(params), [params], { keys: ["public"] });
  const filtered = Boolean(dq || type !== ALL || transaction !== ALL || city !== ALL);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Globe}
        title="ویترین عمومی"
        description="املاک منتشرشده که بدون ورود برای همه قابل مشاهده‌اند"
        actions={
          <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
            <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
          </Button>
        }
      />
      <div className="grid gap-2 md:grid-cols-[1fr_repeat(3,180px)]">
        <SearchInput value={q} onChange={setQ} placeholder="جستجو در آگهی‌های عمومی…" />
        <Select aria-label="شهر" value={city} onValueChange={setCity} options={[{ value: ALL, label: "همه شهرها" }, ...CITIES.map((c) => ({ value: c.code, label: c.name }))]} />
        <Select aria-label="نوع ملک" value={type} onValueChange={setType} options={[{ value: ALL, label: "همه انواع" }, ...PROPERTY_TYPES]} />
        <Select aria-label="نوع معامله" value={transaction} onValueChange={setTransaction} options={[{ value: ALL, label: "همه معاملات" }, ...TRANSACTION_TYPES]} />
      </div>

      {loading ? (
        <ListSkeleton count={6} media grid />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={filtered ? "آگهی‌ای با این فیلتر نیست" : "هنوز ملکی منتشر نشده"}
          description="فقط املاک با وضعیت «منتشرشده» در ویترین عمومی نمایش داده می‌شوند."
        />
      ) : (
        <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <StaggerItem key={p.id}>
              <PublicCard property={p} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}

function PublicCard({ property: p }: { property: PublicProperty }) {
  const price = p.transaction_type === "rent" && p.rent_price ? p.rent_price : p.price;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[16px] bg-card shadow-sm hairline transition hover:border-border-strong hover:shadow-md">
      <Link to={`/p/${encodeURIComponent(p.code)}`} className="relative block h-40 overflow-hidden" aria-label={`صفحه عمومی ${p.title}`}>
        <PropertyVisual image={p.primary_image} type={p.property_type} seed={p.id} alt={p.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 pt-8">
          <p className="tnum text-title font-bold text-white">{compactToman(price)}</p>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{propertyTypeLabel(p.property_type)}</Badge>
          <Badge tone="accent">{transactionLabel(p.transaction_type)}</Badge>
        </div>
        <h3 className="line-clamp-2 font-semibold">{p.title}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {(p.city || p.district) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {[p.city, p.district].filter(Boolean).join("، ")}
            </span>
          )}
          {p.built_area ? (
            <span className="tnum flex items-center gap-1">
              <Ruler className="size-3.5" aria-hidden />
              {faNum(p.built_area)} متر
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Code>{p.code}</Code>
          <div className="flex gap-1">
            <CopyButton text={publicUrl(p.code)} size="icon-sm" variant="ghost" label="" aria-label="کپی لینک عمومی" success="لینک عمومی کپی شد" />
            <Link to={`/p/${encodeURIComponent(p.code)}`} className="grid size-9 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="باز کردن صفحه عمومی">
              <ExternalLink className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
