import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, RotateCw, Star } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import { faNum } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader, StaggerItem, StaggerList } from "@/components/ui/misc";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { PropertyDetailDialog } from "@/features/properties/PropertyDetailDialog";
import { useFavorites } from "./useFavorites";

export default function FavoritesPage() {
  const favorites = useFavorites();
  const props = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties"] });
  const [detailId, setDetailId] = useState<number | null>(null);

  const list = useMemo(() => (props.data ?? []).filter((p) => favorites.ids.has(p.id)), [props.data, favorites.ids]);
  const missing = favorites.ids.size - list.length;
  const loading = favorites.loading || props.loading;
  const error = favorites.error ?? props.error;
  const reload = () => {
    favorites.reload();
    props.reload();
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Star}
        title="علاقه‌مندی‌ها"
        description={favorites.data ? `${faNum(favorites.ids.size)} ملک نشان‌شده` : "املاکی که ستاره زده‌اید"}
        actions={
          <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={favorites.refreshing || props.refreshing}>
            <RotateCw className={favorites.refreshing || props.refreshing ? "animate-spin" : ""} aria-hidden />
          </Button>
        }
      />
      {loading ? (
        <ListSkeleton count={3} media grid />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Star}
          title="هنوز ملکی نشان نکرده‌اید"
          description="روی ستاره هر کارت ملک بزنید تا اینجا برای دسترسی سریع ذخیره شود."
          action={
            <Link to="/app/properties" className={buttonVariants({ variant: "primary" })}>
              <Building2 aria-hidden /> مشاهده املاک
            </Link>
          }
        />
      ) : (
        <>
          <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <StaggerItem key={p.id}>
                <PropertyCard property={p} favorite onToggleFavorite={() => favorites.toggle(p.id)} onOpen={() => setDetailId(p.id)} />
              </StaggerItem>
            ))}
          </StaggerList>
          {missing > 0 && <p className="text-center text-caption text-muted-foreground">{faNum(missing)} مورد دیگر خارج از ۱۰۰ ملک اخیر است.</p>}
        </>
      )}
      <PropertyDetailDialog
        propertyId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        favorite={detailId !== null && favorites.ids.has(detailId)}
        onToggleFavorite={() => detailId !== null && favorites.toggle(detailId)}
      />
    </div>
  );
}
