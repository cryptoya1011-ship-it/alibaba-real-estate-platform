import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpFromLine, Car, Copy, ExternalLink, Link2, Loader2, MapPin, Package, Sparkles, Star, Sun, UserRound, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/api";
import { useApi, invalidate } from "@/hooks/useApi";
import type { AIDescription, AIMatch } from "@/lib/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Code, CopyButton, KeyValue, copyText } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorMessage } from "@/components/ui/states";
import { PROPERTY_STATUSES, PROPERTY_STATUS_TONE, propertyStatusLabel, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum, formatDate, formatToman } from "@/lib/format";
import { MatchList } from "@/features/ai/MatchList";
import { PropertyVisual } from "./PropertyVisual";
import { publicUrl } from "./PropertyCard";

export function PropertyDetailDialog({
  propertyId,
  onOpenChange,
  favorite,
  onToggleFavorite,
  autoSuggest = false,
}: {
  propertyId: number | null;
  onOpenChange: (open: boolean) => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  autoSuggest?: boolean;
}) {
  return (
    <Dialog open={propertyId !== null} onOpenChange={onOpenChange}>
      {propertyId !== null && (
        <DialogContent title="جزئیات ملک" size="lg">
          <DetailBody id={propertyId} favorite={favorite} onToggleFavorite={onToggleFavorite} autoSuggest={autoSuggest} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function DetailBody({ id, favorite, onToggleFavorite, autoSuggest }: { id: number; favorite: boolean; onToggleFavorite: () => void; autoSuggest: boolean }) {
  const { data: p, error, loading, reload, setData } = useApi(() => api.getProperty(id), [id]);
  const [desc, setDesc] = useState<AIDescription | null>(null);
  const [descLoading, setDescLoading] = useState(false);
  const [matches, setMatches] = useState<AIMatch[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoRan, setAutoRan] = useState(false);

  const suggest = async () => {
    setDescLoading(true);
    try {
      setDesc(await api.aiSuggestDescription(id));
    } catch (err) {
      toast.error(errorMessage(err, "پیشنهاد توضیح ناموفق بود"));
    } finally {
      setDescLoading(false);
    }
  };

  useEffect(() => {
    if (autoSuggest && !autoRan && p) {
      setAutoRan(true);
      void suggest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSuggest, autoRan, p]);

  const match = async () => {
    setMatchLoading(true);
    try {
      setMatches(await api.aiMatchProperty(id));
    } catch (err) {
      toast.error(errorMessage(err, "تطبیق ناموفق بود"));
    } finally {
      setMatchLoading(false);
    }
  };

  /** PATCH with optimistic-locking `version`; on 409 refresh and tell the user. */
  const update = async (patch: { status?: string; description?: string }, success: string) => {
    if (!p) return;
    setSaving(true);
    try {
      const updated = await api.updateProperty(id, { ...(patch as object), version: p.version });
      setData({ ...p, ...updated });
      toast.success(success);
      invalidate("properties", "public", "dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        toast.warning("این ملک هم‌زمان تغییر کرده بود؛ اطلاعات تازه شد. دوباره تلاش کنید");
        void reload();
      } else toast.error(errorMessage(err, "ذخیره ناموفق بود"));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-44 w-full rounded-[16px]" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    );
  if (error || !p) return <ErrorState error={error} onRetry={reload} />;

  const loc = p.location;
  const features = [
    { on: p.has_parking, label: "پارکینگ", icon: Car },
    { on: p.has_elevator, label: "آسانسور", icon: ArrowUpFromLine },
    { on: p.has_warehouse, label: "انباری", icon: Package },
    { on: p.has_balcony, label: "بالکن", icon: Sun },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-44 overflow-hidden rounded-[16px] sm:h-56">
        <PropertyVisual image={p.primary_image} type={p.property_type} seed={p.id} alt={p.title} />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
          <div>
            <p className="tnum text-display font-extrabold text-white">{compactToman(p.price)}</p>
            {p.price ? <p className="tnum text-caption text-white/80">{formatToman(p.price)}</p> : null}
          </div>
          <Badge tone={PROPERTY_STATUS_TONE[p.status] ?? "neutral"} className="bg-card/90">
            {propertyStatusLabel(p.status)}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-title-lg font-bold">{p.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Code className="rounded-md bg-muted px-2 py-0.5">{p.code}</Code>
          <CopyButton text={p.code} success="کد ملک کپی شد" />
          <Badge tone="primary">{propertyTypeLabel(p.property_type)}</Badge>
          <Badge tone="accent">{transactionLabel(p.transaction_type)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant={favorite ? "accent" : "secondary"} onClick={onToggleFavorite} aria-pressed={favorite}>
          <Star className={favorite ? "fill-current" : ""} aria-hidden />
          {favorite ? "علاقه‌مندی" : "افزودن ★"}
        </Button>
        <Button variant="secondary" onClick={() => copyText(publicUrl(p.code), "لینک عمومی کپی شد")}>
          <Link2 aria-hidden /> کپی لینک
        </Button>
        <a href={`/p/${encodeURIComponent(p.code)}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
          <ExternalLink aria-hidden /> صفحه عمومی
        </a>
        <Button variant="soft" onClick={suggest} loading={descLoading}>
          <Sparkles aria-hidden /> توضیح AI
        </Button>
      </div>

      {desc && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[16px] border border-primary/25 bg-primary-soft p-4">
          <div className="mb-2 flex items-center gap-2 text-caption font-semibold text-primary">
            <Wand2 className="size-4" aria-hidden /> توضیح پیشنهادی هوش مصنوعی
          </div>
          <p className="leading-8">{desc.suggested_description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => update({ description: desc.suggested_description }, "توضیحات ملک به‌روز شد")} loading={saving}>
              جایگزینی توضیحات ملک
            </Button>
            <Button size="sm" variant="secondary" onClick={() => copyText(desc.suggested_description)}>
              <Copy aria-hidden /> کپی
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KeyValue label="متراژ" value={p.built_area ? `${faNum(p.built_area)} متر` : "—"} />
        <KeyValue label="اتاق" value={faNum(p.rooms)} />
        <KeyValue label="طبقه" value={p.floor_number != null ? faNum(p.floor_number) : "—"} />
        <KeyValue label="ثبت" value={formatDate(p.created_at)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f.label}
            className={
              f.on
                ? "flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-caption font-medium text-success"
                : "flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-caption text-muted-foreground line-through decoration-1"
            }
          >
            <f.icon className="size-3.5" aria-hidden />
            {f.label}
          </span>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] bg-card-2 p-3.5 hairline">
          <p className="mb-1 flex items-center gap-1.5 text-caption text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> موقعیت
          </p>
          <p className="font-medium">{[loc?.city, loc?.district, loc?.neighborhood].filter(Boolean).join("، ") || "—"}</p>
          {loc?.exact_address && <p className="mt-1 text-caption text-muted-foreground">{loc.exact_address}</p>}
        </div>
        <div className="rounded-[14px] bg-card-2 p-3.5 hairline">
          <p className="mb-1 flex items-center gap-1.5 text-caption text-muted-foreground">
            <UserRound className="size-3.5" aria-hidden /> مالک (محرمانه)
          </p>
          <p className="font-medium">{p.owner_name || "—"}</p>
          {p.owner_phone && (
            <a href={`tel:${p.owner_phone}`} dir="ltr" className="font-mono text-caption text-primary">
              {p.owner_phone}
            </a>
          )}
        </div>
      </div>

      {p.description && (
        <div>
          <p className="mb-1 text-caption text-muted-foreground">توضیحات</p>
          <p className="leading-8">{p.description}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-[16px] bg-card-2 p-3.5 hairline">
        <p className="text-caption font-semibold">تغییر وضعیت</p>
        <div className="flex items-center gap-2">
          <Select
            value={p.status}
            onValueChange={(v) => v !== p.status && update({ status: v }, `وضعیت به «${propertyStatusLabel(v)}» تغییر کرد`)}
            options={PROPERTY_STATUSES}
            disabled={saving}
            aria-label="وضعیت ملک"
          />
          {saving && <Loader2 className="size-5 animate-spin text-primary" aria-hidden />}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">تطبیق با درخواست مشتریان</p>
          <Button size="sm" variant="soft" onClick={match} loading={matchLoading}>
            <Sparkles aria-hidden /> تطبیق هوشمند
          </Button>
        </div>
        {matches && <MatchList matches={matches} emptyHint="برای این ملک درخواست مشتری مطابقی ثبت نشده است." />}
      </div>
    </div>
  );
}
