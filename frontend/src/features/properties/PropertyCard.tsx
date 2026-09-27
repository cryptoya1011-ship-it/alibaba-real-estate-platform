import { motion } from "framer-motion";
import { Car, Link2, MapPin, MoreVertical, Ruler, Star, ArrowUpDown, ExternalLink, Sparkles } from "lucide-react";
import type { PropertyListItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Code, copyText } from "@/components/ui/misc";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { PROPERTY_STATUS_TONE, propertyStatusLabel, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PropertyVisual } from "./PropertyVisual";

export function publicUrl(code: string) {
  return `${window.location.origin}/p/${encodeURIComponent(code)}`;
}

export function PropertyCard({
  property,
  favorite,
  onToggleFavorite,
  onOpen,
  onSuggest,
}: {
  property: PropertyListItem;
  favorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
  onSuggest?: () => void;
}) {
  const p = property;
  const price = p.transaction_type === "rent" && p.rent_price ? p.rent_price : p.price;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[16px] bg-card hairline shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong hover:shadow-md">
      <button type="button" onClick={onOpen} className="relative block h-36 w-full overflow-hidden text-start" aria-label={`جزئیات ${p.title}`}>
        <PropertyVisual image={p.primary_image} type={p.property_type} seed={p.id} alt={p.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <Badge tone={PROPERTY_STATUS_TONE[p.status] ?? "neutral"} className="bg-card/85 backdrop-blur">
            {propertyStatusLabel(p.status)}
          </Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 pt-8">
          <p className="tnum text-title font-bold text-white drop-shadow">
            {compactToman(price)}
            {p.transaction_type === "rent" && p.rent_price ? <span className="text-caption font-normal"> / ماهانه</span> : null}
          </p>
        </div>
      </button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        className={cn(
          "absolute end-2.5 top-2.5 grid size-9 place-items-center rounded-full backdrop-blur transition",
          favorite ? "bg-accent text-accent-foreground" : "bg-card/80 text-muted-foreground hover:text-accent",
        )}
      >
        <Star className={cn("size-[18px]", favorite && "fill-current")} aria-hidden />
      </motion.button>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
            <h3 className="line-clamp-1 text-title font-semibold">{p.title}</h3>
            <Code className="block truncate text-[11px]">{p.code}</Code>
          </button>
          <DropdownMenu dir="rtl">
            <DropdownTrigger asChild>
              <button type="button" aria-label="گزینه‌ها" className="-me-1.5 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                <MoreVertical className="size-[18px]" aria-hidden />
              </button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={onOpen}>
                <ArrowUpDown aria-hidden /> جزئیات و وضعیت
              </DropdownItem>
              <DropdownItem onSelect={() => copyText(publicUrl(p.code), "لینک عمومی کپی شد")}>
                <Link2 aria-hidden /> کپی لینک عمومی
              </DropdownItem>
              <DropdownItem onSelect={() => window.open(`/p/${encodeURIComponent(p.code)}`, "_blank", "noopener")}>
                <ExternalLink aria-hidden /> مشاهده صفحه عمومی
              </DropdownItem>
              {onSuggest && (
                <DropdownItem onSelect={onSuggest}>
                  <Sparkles aria-hidden /> پیشنهاد توضیح با AI
                </DropdownItem>
              )}
            </DropdownContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {[p.city, p.district].filter(Boolean).join("، ") || "—"}
          </span>
          {p.built_area ? (
            <span className="tnum flex items-center gap-1">
              <Ruler className="size-3.5" aria-hidden />
              {faNum(p.built_area)} متر
            </span>
          ) : null}
          {p.has_parking && (
            <span className="flex items-center gap-1">
              <Car className="size-3.5" aria-hidden />
              پارکینگ
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <Badge tone="primary">{propertyTypeLabel(p.property_type)}</Badge>
          <Badge tone="accent">{transactionLabel(p.transaction_type)}</Badge>
          {p.has_elevator && <Badge tone="outline">آسانسور</Badge>}
        </div>
      </div>
    </article>
  );
}
