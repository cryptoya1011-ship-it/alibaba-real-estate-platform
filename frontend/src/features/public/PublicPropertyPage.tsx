import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building,
  Car,
  Check,
  ExternalLink,
  Fence,
  Layers,
  MapPin,
  Package,
  Ruler,
  Share2,
  SearchX,
  X,
  ArrowUpDown,
  CalendarDays,
  Repeat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, ApiError, mediaUrl } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/hooks/useSession";
import type { PublicProperty } from "@/lib/types";
import { propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { faNum, formatToman, compactToman } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Code, CopyButton, copyText } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Brand } from "@/components/layout/Brand";
import { ThemeToggle } from "@/components/layout/TopbarActions";
import { PropertyGallery } from "@/features/properties/PropertyGallery";
import { AMENITIES, typeConfig } from "@/features/properties/propertyConfig";
import { publicUrl } from "@/features/properties/PropertyCard";

const DEFAULT_TITLE = document.title;

function setMeta(selector: string, content: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", content);
}

/** Document title + description + OG tags for share previews (restored on unmount). */
function useSeo(p: PublicProperty | undefined) {
  useEffect(() => {
    if (!p) return;
    const desc = (p.description ?? "").slice(0, 160) || p.title;
    document.title = `${p.title} — املاک علی‌بابا`;
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', p.title);
    setMeta('meta[property="og:description"]', desc);
    const image = mediaUrl(p.primary_image, "full");
    if (image) setMeta('meta[property="og:image"]', new URL(image, window.location.origin).href);
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [p]);
}

export default function PublicPropertyPage() {
  const { code = "" } = useParams();
  const { status } = useSession();
  const { data, error, loading, reload } = useApi(() => api.publicGetByCode(code), [code]);
  useSeo(data);
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="min-h-dvh bg-background">
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Link to={status === "authenticated" ? "/app/public" : "/login"} aria-label="صفحه اصلی علی‌بابا" className="rounded-[12px]">
            <Brand />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {status === "authenticated" ? (
              <Link to="/app/public" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                <ArrowRight aria-hidden /> پنل
              </Link>
            ) : (
              <Link to="/login" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                ورود
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="aspect-[16/9] w-full rounded-[20px] md:aspect-[21/9]" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        ) : notFound ? (
          <EmptyState
            icon={SearchX}
            title="این آگهی پیدا نشد"
            description={
              <>
                آگهی با کد <Code>{code}</Code> وجود ندارد یا دیگر منتشر نیست.
              </>
            }
            action={
              <Link to="/login" className={buttonVariants({ variant: "primary" })}>
                رفتن به علی‌بابا
              </Link>
            }
          />
        ) : error || !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <PropertyView p={data} />
        )}
      </main>
    </div>
  );
}

function PropertyView({ p }: { p: PublicProperty }) {
  const cover = p.primary_image ?? null;
  const images = cover ? [cover, ...p.images.filter((k) => k !== cover)] : p.images;
  const isRent = p.transaction_type === "rent";
  const hasCoords = typeof p.public_lat === "number" && typeof p.public_lng === "number";
  const url = publicUrl(p.code);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: p.title, url });
        return;
      } catch {
        /* user cancelled — fall back to copy */
      }
    }
    await copyText(url, "لینک آگهی کپی شد");
  };

  const facts: { icon: LucideIcon; label: string; value: string }[] = [];
  if (p.built_area) facts.push({ icon: Ruler, label: "متراژ بنا", value: `${faNum(p.built_area)} متر` });
  if (p.land_area) facts.push({ icon: Fence, label: "متراژ زمین", value: `${faNum(p.land_area)} متر` });
  if (p.rooms ?? p.bedrooms) facts.push({ icon: BedDouble, label: "اتاق", value: faNum(p.rooms ?? p.bedrooms) });
  if (p.bathrooms) facts.push({ icon: Bath, label: "سرویس", value: faNum(p.bathrooms) });
  if (p.useful_area) facts.push({ icon: Ruler, label: "متراژ مفید", value: `${faNum(p.useful_area)} متر` });
  if (p.year_built) facts.push({ icon: CalendarDays, label: "سال ساخت", value: faNum(String(p.year_built)) });
  if (p.floor_number !== null && p.floor_number !== undefined)
    facts.push({ icon: Layers, label: "طبقه", value: p.total_floors ? `${faNum(p.floor_number)} از ${faNum(p.total_floors)}` : faNum(p.floor_number) });

  const core = typeConfig(p.property_type).core;
  const amenities: { icon: LucideIcon; label: string; on: boolean | undefined }[] = [
    { key: "has_parking", icon: Car, label: "پارکینگ", on: p.has_parking },
    { key: "has_elevator", icon: ArrowUpDown, label: "آسانسور", on: p.has_elevator },
    { key: "has_warehouse", icon: Package, label: "انباری", on: p.has_warehouse },
    { key: "has_balcony", icon: Building, label: "بالکن", on: p.has_balcony },
  ]
    .filter((a) => a.on || core.includes(a.key as (typeof core)[number]))
    .map(({ icon, label, on }) => ({ icon, label, on }));
  (p.amenities ?? []).forEach((key) => {
    const known = AMENITIES.find((a) => a.key === key);
    if (known) amenities.push({ icon: known.icon, label: known.label, on: true });
  });
  if (p.is_exchangeable) amenities.push({ icon: Repeat, label: "قابل معاوضه", on: true });

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
      {/* Gallery */}
      <section aria-label="تصاویر ملک">
        <PropertyGallery
          images={images}
          type={p.property_type}
          seed={p.id}
          alt={p.title}
          className="aspect-[16/10] rounded-[20px] hairline md:aspect-[21/9]"
          overlay={
            <div className="pointer-events-none absolute start-3 top-3 flex gap-1.5">
              <Badge tone="primary" className="bg-card/85 backdrop-blur">
                {propertyTypeLabel(p.property_type)}
              </Badge>
              <Badge tone="accent" className="bg-card/85 backdrop-blur">
                {transactionLabel(p.transaction_type)}
              </Badge>
            </div>
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-display-lg font-extrabold leading-tight tracking-tight">{p.title}</h1>
            <p className="flex flex-wrap items-center gap-2 text-body text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {[p.city, p.district, p.neighborhood].filter(Boolean).join("، ") || "موقعیت نامشخص"}
              <span aria-hidden>·</span>
              <Code>{p.code}</Code>
            </p>
          </header>

          {facts.length > 0 && (
            <section aria-label="مشخصات" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
              {facts.map((f) => (
                <div key={f.label} className="flex flex-col gap-1 rounded-[14px] bg-card p-3 hairline">
                  <f.icon className="size-[18px] text-primary" aria-hidden />
                  <span className="text-caption text-muted-foreground">{f.label}</span>
                  <span className="tnum font-bold">{f.value}</span>
                </div>
              ))}
            </section>
          )}

          {amenities.length > 0 && (
          <section aria-labelledby="amenities" className="flex flex-col gap-3">
            <h2 id="amenities" className="text-title font-semibold">
              امکانات
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {amenities.map((a) => (
                <li
                  key={a.label}
                  className={cn("flex items-center gap-2 rounded-[12px] p-2.5 text-body hairline", a.on ? "bg-success-soft text-foreground" : "bg-card text-muted-foreground")}
                >
                  <a.icon className="size-4" aria-hidden />
                  <span className="flex-1">{a.label}</span>
                  {a.on ? <Check className="size-4 text-success" aria-label="دارد" /> : <X className="size-4" aria-label="ندارد" />}
                </li>
              ))}
            </ul>
          </section>
          )}

          {p.description && (
            <section aria-labelledby="desc" className="flex flex-col gap-2">
              <h2 id="desc" className="text-title font-semibold">
                توضیحات
              </h2>
              <p className="whitespace-pre-line text-body leading-8 text-muted-foreground">{p.description}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-col gap-3 rounded-[18px] bg-card p-4 shadow-md hairline">
            <span className="text-caption text-muted-foreground">{isRent ? "اجاره ماهانه" : "قیمت"}</span>
            <p className="tnum text-display-lg font-extrabold text-primary">{formatToman(isRent ? p.rent_price ?? p.price : p.price)}</p>
            {isRent && p.deposit ? (
              <p className="tnum text-body text-muted-foreground">
                ودیعه: <b className="text-foreground">{formatToman(p.deposit)}</b>
              </p>
            ) : null}
            {!isRent && p.price && p.built_area ? (
              <p className="tnum text-caption text-muted-foreground">هر متر حدود {compactToman(Math.round(p.price / p.built_area))}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button onClick={share} variant="primary">
                <Share2 aria-hidden /> اشتراک
              </Button>
              <CopyButton text={url} label="کپی لینک" size="md" success="لینک آگهی کپی شد" />
            </div>
          </div>
          {hasCoords && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${p.public_lat}&mlon=${p.public_lng}#map=16/${p.public_lat}/${p.public_lng}`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-[18px] bg-card p-4 hairline transition hover:border-border-strong"
            >
              <span className="grid size-11 place-items-center rounded-[12px] bg-info-soft text-info">
                <MapPin className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">مشاهده روی نقشه</span>
                <span className="text-caption text-muted-foreground">موقعیت تقریبی در OpenStreetMap</span>
              </span>
              <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground" aria-hidden />
            </a>
          )}
        </aside>
      </div>
    </motion.article>
  );
}
