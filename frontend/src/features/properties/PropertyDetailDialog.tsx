import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Handshake,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  Repeat,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/api";
import { useApi, invalidate } from "@/hooks/useApi";
import { useCan } from "@/hooks/useSession";
import type { AIDescription, AIMatch, PropertyDetail, PropertyReviewAction } from "@/lib/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { Code, CopyButton, KeyValue, copyText } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorMessage } from "@/components/ui/states";
import { PERM_PROPERTY_APPROVE, PROPERTY_STATUSES, PROPERTY_STATUS_TONE, propertyStatusLabel, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum, formatDate, formatToman } from "@/lib/format";
import { MatchList } from "@/features/ai/MatchList";
import { publicUrl } from "./PropertyCard";
import { PropertyForm } from "./PropertyForm";
import { PhotoManager } from "./PhotoManager";
import { PropertyGallery, orderedImageKeys } from "./PropertyGallery";
import { AMENITIES, CORE_FEATURES, REGISTRANT_TYPES, SPEC_LABELS, parseAmenities, typeConfig } from "./propertyConfig";

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
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [propertyId]);
  return (
    <Dialog open={propertyId !== null} onOpenChange={onOpenChange}>
      {propertyId !== null && (
        <DialogContent title={editing ? "ویرایش ملک" : "جزئیات ملک"} size="lg">
          <DetailBody
            id={propertyId}
            favorite={favorite}
            onToggleFavorite={onToggleFavorite}
            autoSuggest={autoSuggest}
            editing={editing}
            setEditing={setEditing}
            onDeleted={() => onOpenChange(false)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function priceSummary(p: PropertyDetail): { main: string; sub?: string } {
  if (p.transaction_type === "rent") {
    const rent = p.rent_price ? `${compactToman(p.rent_price)} / ماه` : "اجاره توافقی";
    return { main: rent, sub: p.deposit ? `ودیعه ${compactToman(p.deposit)}` : undefined };
  }
  if (p.transaction_type === "partnership") {
    return {
      main: "مشارکت در ساخت",
      sub: p.owner_share != null || p.builder_share != null ? `مالک ${faNum(p.owner_share ?? 0)}٪ · سازنده ${faNum(p.builder_share ?? 0)}٪` : undefined,
    };
  }
  return { main: compactToman(p.price), sub: p.price ? formatToman(p.price) : undefined };
}

function DetailBody({
  id,
  favorite,
  onToggleFavorite,
  autoSuggest,
  editing,
  setEditing,
  onDeleted,
}: {
  id: number;
  favorite: boolean;
  onToggleFavorite: () => void;
  autoSuggest: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const can = useCan();
  const confirm = useConfirm();
  const { data: p, error, loading, reload, setData } = useApi(() => api.getProperty(id), [id]);
  const [desc, setDesc] = useState<AIDescription | null>(null);
  const [descLoading, setDescLoading] = useState(false);
  const [matches, setMatches] = useState<AIMatch[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const canUpdate = can("property:update");
  const canDelete = can("property:delete");
  const canApprove = can(PERM_PROPERTY_APPROVE);

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

  const remove = async () => {
    if (!p) return;
    const yes = await confirm({
      title: "حذف ملک؟",
      description: `«${p.title}» از فهرست املاک، ویترین عمومی و علاقه‌مندی‌ها حذف می‌شود.`,
      confirmLabel: "حذف ملک",
      destructive: true,
    });
    if (!yes) return;
    setDeleting(true);
    try {
      await api.deleteProperty(p.id, p.version);
      toast.success("ملک حذف شد");
      invalidate("properties", "public", "dashboard", "favorites");
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        toast.warning("ملک هم‌زمان تغییر کرده بود؛ اطلاعات تازه شد");
        void reload();
      } else toast.error(errorMessage(err, "حذف ناموفق بود"));
    } finally {
      setDeleting(false);
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

  if (editing) {
    return (
      <PropertyForm
        initial={p}
        onDone={(saved) => {
          if (saved) setData({ ...p, ...saved });
          setEditing(false);
          void reload();
        }}
      />
    );
  }

  const loc = p.location;
  const cfg = typeConfig(p.property_type);
  const price = priceSummary(p);
  const amenities = parseAmenities(p.amenities_json);
  const images = orderedImageKeys(p.media);
  const features = CORE_FEATURES.filter((f) => cfg.core.includes(f.key) || p[f.key]);
  const extraAmenities = AMENITIES.filter((a) => amenities[a.key]);

  const facts: { label: string; value: string }[] = [];
  if (p.land_area) facts.push({ label: "زمین", value: `${faNum(p.land_area)} متر` });
  if (p.built_area) facts.push({ label: "بنا", value: `${faNum(p.built_area)} متر` });
  if (p.useful_area) facts.push({ label: "مفید", value: `${faNum(p.useful_area)} متر` });
  if (p.floor_area) facts.push({ label: "کف / دهنه", value: `${faNum(p.floor_area)} متر` });
  (["rooms", "bedrooms", "bathrooms", "year_built"] as const).forEach((k) => {
    if (p[k] != null) facts.push({ label: SPEC_LABELS[k].replace(" (شمسی)", ""), value: k === "year_built" ? faNum(String(p[k])) : faNum(p[k]) });
  });
  if (p.floor_number != null)
    facts.push({ label: "طبقه", value: p.total_floors ? `${faNum(p.floor_number)} از ${faNum(p.total_floors)}` : faNum(p.floor_number) });
  else if (p.total_floors) facts.push({ label: "طبقات", value: faNum(p.total_floors) });
  facts.push({ label: "ثبت", value: formatDate(p.created_at) });

  const registrant = REGISTRANT_TYPES.find((r) => r.value === p.registrant_type)?.label;

  return (
    <div className="flex flex-col gap-5">
      <PropertyGallery
        images={images}
        type={p.property_type}
        seed={p.id}
        alt={p.title}
        className="h-48 sm:h-64"
        overlay={
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/65 to-transparent p-4 pt-12">
            <div>
              <p className="tnum text-display font-extrabold text-white">{price.main}</p>
              {price.sub ? <p className="tnum text-caption text-white/85">{price.sub}</p> : null}
            </div>
            <Badge tone={PROPERTY_STATUS_TONE[p.status] ?? "neutral"} className="bg-card/90">
              {propertyStatusLabel(p.status)}
            </Badge>
          </div>
        }
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-title-lg font-bold">{p.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Code className="rounded-md bg-muted px-2 py-0.5">{p.code}</Code>
          <CopyButton text={p.code} success="کد ملک کپی شد" />
          <Badge tone="primary">{propertyTypeLabel(p.property_type)}</Badge>
          <Badge tone="accent">{transactionLabel(p.transaction_type)}</Badge>
          {p.is_exchangeable && p.transaction_type !== "exchange" && <Badge tone="info">قابل معاوضه</Badge>}
          {registrant && <Badge tone="outline">ثبت: {registrant}</Badge>}
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
        {canUpdate && (
          <Button variant="primary" onClick={() => setEditing(true)} className="col-span-1 sm:col-span-2">
            <Pencil aria-hidden /> ویرایش کامل
          </Button>
        )}
        {canDelete && (
          <Button variant="danger" onClick={remove} loading={deleting} className="col-span-1 sm:col-span-2">
            <Trash2 aria-hidden /> حذف ملک
          </Button>
        )}
      </div>

      {desc && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[16px] border border-primary/25 bg-primary-soft p-4">
          <div className="mb-2 flex items-center gap-2 text-caption font-semibold text-primary">
            <Wand2 className="size-4" aria-hidden /> توضیح پیشنهادی هوش مصنوعی
          </div>
          <p className="leading-8">{desc.suggested_description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canUpdate && (
              <Button size="sm" onClick={() => update({ description: desc.suggested_description }, "توضیحات ملک به‌روز شد")} loading={saving}>
                جایگزینی توضیحات ملک
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => copyText(desc.suggested_description)}>
              <Copy aria-hidden /> کپی
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map((f) => (
          <KeyValue key={f.label} label={f.label} value={<span className="tnum">{f.value}</span>} />
        ))}
      </div>

      {p.transaction_type === "rent" && (
        <div className="grid grid-cols-2 gap-2">
          <KeyValue label="ودیعه / رهن" value={<span className="tnum">{formatToman(p.deposit, "—")}</span>} />
          <KeyValue label="اجاره ماهانه" value={<span className="tnum">{formatToman(p.rent_price, "—")}</span>} />
        </div>
      )}
      {(p.transaction_type === "exchange" || p.is_exchangeable) && p.exchange_description && (
        <InfoBox icon={Repeat} title="شرایط معاوضه" body={p.exchange_description} />
      )}
      {p.transaction_type === "partnership" && (
        <div className="grid grid-cols-2 gap-2">
          <KeyValue label="سهم مالک" value={p.owner_share != null ? `${faNum(p.owner_share)}٪` : "—"} />
          <KeyValue label="سهم سازنده" value={p.builder_share != null ? `${faNum(p.builder_share)}٪` : "—"} />
          {p.partnership_description && (
            <div className="col-span-2">
              <InfoBox icon={Handshake} title="شرایط مشارکت" body={p.partnership_description} />
            </div>
          )}
        </div>
      )}

      {(features.length > 0 || extraAmenities.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {features.map((f) => (
            <span
              key={f.key}
              className={
                p[f.key]
                  ? "flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-caption font-medium text-success"
                  : "flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-caption text-muted-foreground line-through decoration-1"
              }
            >
              <f.icon className="size-3.5" aria-hidden />
              {f.label}
            </span>
          ))}
          {extraAmenities.map((a) => (
            <span key={a.key} className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-caption font-medium text-primary">
              <a.icon className="size-3.5" aria-hidden />
              {a.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <ImageIcon className="size-4 text-primary" aria-hidden /> عکس‌ها
          <span className="tnum text-caption font-normal text-muted-foreground">({faNum(images.length)})</span>
        </p>
        <PhotoManager
          propertyId={p.id}
          media={p.media ?? []}
          canEdit={canUpdate}
          onChange={(media) => setData((prev) => ({ ...(prev ?? p), media }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] bg-card-2 p-3.5 hairline">
          <p className="mb-1 flex items-center gap-1.5 text-caption text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> موقعیت
          </p>
          <p className="font-medium">{[loc?.city, loc?.district, loc?.neighborhood].filter(Boolean).join("، ") || "—"}</p>
          {loc?.exact_address && <p className="mt-1 text-caption text-muted-foreground">{loc.exact_address}</p>}
          {loc?.postal_code && (
            <p className="mt-1 text-caption text-muted-foreground">
              کد پستی: <span dir="ltr" className="font-mono">{loc.postal_code}</span>
            </p>
          )}
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

      {p.legal_info && <InfoBox icon={FileText} title="وضعیت سند و اطلاعات حقوقی" body={p.legal_info} />}

      {p.description && (
        <div>
          <p className="mb-1 text-caption text-muted-foreground">توضیحات</p>
          <p className="whitespace-pre-line leading-8">{p.description}</p>
        </div>
      )}

      <ReviewPanel
        p={p}
        canApprove={canApprove}
        canUpdate={canUpdate}
        saving={saving}
        onSubmitForReview={() => update({ status: "pending_review" }, "ملک برای بررسی مدیر ارسال شد")}
        onReviewed={(updated) => {
          setData({ ...p, ...updated });
          invalidate("properties", "public", "dashboard", "notifications");
        }}
        onConflict={() => void reload()}
      />

      {canApprove && (
        <div className="flex flex-col gap-2 rounded-[16px] bg-card-2 p-3.5 hairline">
          <p className="text-caption font-semibold">تغییر سریع وضعیت</p>
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
      )}

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

/**
 * Official-inventory review (business rules §7): the consultant submits, a manager
 * approves / rejects / requests changes. Hidden when there is nothing to do.
 */
function ReviewPanel({
  p,
  canApprove,
  canUpdate,
  saving,
  onSubmitForReview,
  onReviewed,
  onConflict,
}: {
  p: PropertyDetail;
  canApprove: boolean;
  canUpdate: boolean;
  saving: boolean;
  onSubmitForReview: () => void;
  onReviewed: (updated: PropertyDetail) => void;
  onConflict: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<PropertyReviewAction | "publish" | null>(null);
  const reviewable = p.status === "pending_review" || p.status === "changes_requested";
  const canSubmit = !canApprove && canUpdate && (p.status === "draft" || p.status === "changes_requested");
  const showNote = !!p.review_note && (p.status === "changes_requested" || p.status === "rejected");

  if (!showNote && !canSubmit && !(canApprove && reviewable) && p.status !== "pending_review") return null;

  const review = async (action: PropertyReviewAction, publish = false) => {
    if (action !== "approve" && !note.trim()) {
      toast.warning("برای رد یا درخواست اصلاح، توضیح بنویسید");
      return;
    }
    setBusy(publish ? "publish" : action);
    try {
      const updated = await api.reviewProperty(p.id, { action, note: note.trim() || null, publish, version: p.version });
      onReviewed(updated);
      setNote("");
      toast.success(
        action === "approve" ? (publish ? "ملک تأیید و منتشر شد" : "ملک تأیید شد") : action === "reject" ? "ملک رد شد" : "درخواست اصلاح برای ثبت‌کننده ارسال شد",
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        toast.warning("این ملک هم‌زمان تغییر کرده بود؛ اطلاعات تازه شد");
        onConflict();
      } else toast.error(errorMessage(err, "ثبت نتیجهٔ بررسی ناموفق بود"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-warning/30 bg-warning-soft p-3.5">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-5 text-warning" aria-hidden />
        <p className="font-semibold">بررسی ملک</p>
        <Badge tone={PROPERTY_STATUS_TONE[p.status] ?? "neutral"}>{propertyStatusLabel(p.status)}</Badge>
      </div>

      {showNote && (
        <p className="rounded-[12px] bg-card/80 p-3 text-body-sm leading-7">
          <span className="font-semibold">نظر مدیر: </span>
          {p.review_note}
        </p>
      )}

      {p.status === "pending_review" && !canApprove && <p className="text-body-sm text-muted-foreground">در انتظار تأیید مدیر است.</p>}

      {canSubmit && (
        <Button onClick={onSubmitForReview} loading={saving}>
          <Send aria-hidden /> ارسال برای بررسی
        </Button>
      )}

      {canApprove && reviewable && (
        <>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح برای ثبت‌کننده (برای رد یا اصلاح الزامی است)" aria-label="توضیح بررسی" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button onClick={() => review("approve", true)} loading={busy === "publish"} disabled={!!busy}>
              <Check aria-hidden /> تأیید و انتشار
            </Button>
            <Button variant="secondary" onClick={() => review("approve")} loading={busy === "approve"} disabled={!!busy}>
              تأیید
            </Button>
            <Button variant="outline" onClick={() => review("request_changes")} loading={busy === "request_changes"} disabled={!!busy}>
              درخواست اصلاح
            </Button>
            <Button variant="danger" onClick={() => review("reject")} loading={busy === "reject"} disabled={!!busy}>
              رد
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function InfoBox({ icon: Icon, title, body }: { icon: typeof FileText; title: string; body: string }) {
  return (
    <div className="rounded-[14px] bg-card-2 p-3.5 hairline">
      <p className="mb-1 flex items-center gap-1.5 text-caption text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {title}
      </p>
      <p className="whitespace-pre-line leading-7">{body}</p>
    </div>
  );
}
