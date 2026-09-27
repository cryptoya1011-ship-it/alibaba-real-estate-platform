import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Check, Handshake, History, Plus, RotateCw, Trash2, UserRound, XCircle } from "lucide-react";
import { useCan } from "@/hooks/useSession";
import { api, ApiError } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useCreateParam } from "@/hooks/useCreateParam";
import { useLookups } from "@/hooks/useLookups";
import { useDebounced } from "@/hooks/useMisc";
import type { Deal, DealStatus, Person, PropertyListItem } from "@/lib/types";
import { DEAL_PIPELINE, DEAL_STAGES, DEAL_TRANSITIONS, dealStageLabel } from "@/lib/constants";
import { compactToman, faNum, formatDateTime, formatToman, parseNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { Code, CopyButton, KeyValue, PageHeader, SectionTitle, StaggerItem, StaggerList, Timeline } from "@/components/ui/misc";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { Fab } from "@/components/ui/fab";
import { useConfirm } from "@/components/ui/confirm";

type Filter = "all" | "active" | "won" | "lost";
const CLOSED = new Set(["closed_won", "closed_lost", "archived"]);

function stage(status: string) {
  return DEAL_STAGES[status as DealStatus] ?? { label: status, tone: "neutral" as const };
}

function nextStage(status: string): DealStatus | null {
  const idx = DEAL_PIPELINE.indexOf(status as DealStatus);
  if (idx < 0 || idx >= DEAL_PIPELINE.length - 1) return null;
  const next = DEAL_PIPELINE[idx + 1];
  return DEAL_TRANSITIONS[status as DealStatus]?.includes(next) ? next : null;
}

function progress(status: string) {
  if (status === "closed_won") return 1;
  const idx = DEAL_PIPELINE.indexOf(status as DealStatus);
  return idx < 0 ? 0 : idx / (DEAL_PIPELINE.length - 1);
}

export default function DealsPage() {
  const [params, setParams] = useSearchParams();
  const code = params.get("code");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useCreateParam();
  const [openId, setOpenId] = useState<number | null>(null);
  const dq = useDebounced(q, 250).trim().toLowerCase();
  const { data, error, loading, reload, refreshing } = useApi(() => api.listDeals({ limit: 100 }), [], { keys: ["deals"] });
  const lookups = useLookups();

  // Deep link: /app/deals?code=DL-… (also /d/:code) → highlight + open.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    api
      .getDealByCode(code)
      .then((d) => {
        if (!cancelled) setOpenId(d.id);
      })
      .catch((err) => toast.error(errorMessage(err, `معامله ${code} پیدا نشد`)));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const closeDetail = () => {
    setOpenId(null);
    if (code) {
      const p = new URLSearchParams(params);
      p.delete("code");
      setParams(p, { replace: true });
    }
  };

  const counts = useMemo(() => {
    const l = data ?? [];
    return {
      all: l.length,
      active: l.filter((d) => !CLOSED.has(d.status)).length,
      won: l.filter((d) => d.status === "closed_won").length,
      lost: l.filter((d) => d.status === "closed_lost").length,
    };
  }, [data]);

  const pipelineValue = useMemo(() => (data ?? []).filter((d) => !CLOSED.has(d.status)).reduce((s, d) => s + (d.amount ?? 0), 0), [data]);

  const visible = useMemo(() => {
    let l = data ?? [];
    if (filter === "active") l = l.filter((d) => !CLOSED.has(d.status));
    if (filter === "won") l = l.filter((d) => d.status === "closed_won");
    if (filter === "lost") l = l.filter((d) => d.status === "closed_lost");
    if (dq) l = l.filter((d) => d.title.toLowerCase().includes(dq) || d.code.toLowerCase().includes(dq));
    return l;
  }, [data, filter, dq]);

  const highlighted = openId;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Handshake}
        title="معاملات"
        description={data ? `ارزش قیف فعال: ${compactToman(pipelineValue, "۰")}` : "قیف فروش و اجاره"}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
              <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> معامله جدید
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="جستجوی عنوان یا کد معامله…" className="md:flex-1" />
        <Segmented<Filter>
          aria-label="وضعیت معامله"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "همه", count: counts.all },
            { value: "active", label: "فعال", count: counts.active },
            { value: "won", label: "موفق", count: counts.won },
            { value: "lost", label: "ناموفق", count: counts.lost },
          ]}
        />
      </div>

      {loading ? (
        <RowSkeleton count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={data && data.length > 0 ? "معامله‌ای با این فیلتر نیست" : "هنوز معامله‌ای ثبت نشده"}
          description="هر معامله از «سرنخ» شروع می‌شود و مرحله به مرحله تا «موفق» پیش می‌رود."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> معامله جدید
            </Button>
          }
        />
      ) : (
        <StaggerList className="grid gap-2.5 md:grid-cols-2">
          {visible.map((d) => (
            <StaggerItem key={d.id}>
              <DealCard
                deal={d}
                person={lookups.personMap.get(d.customer_id)}
                property={d.property_id ? lookups.propMap.get(d.property_id) : undefined}
                highlighted={highlighted === d.id}
                onOpen={() => setOpenId(d.id)}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <Fab label="معامله جدید" onClick={() => setCreateOpen(true)} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="معامله جدید" description="با مرحله «سرنخ» ایجاد می‌شود">
          <DealForm properties={lookups.properties} persons={lookups.persons} onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={openId !== null} onOpenChange={(o) => !o && closeDetail()}>
        {openId !== null && (
          <DealDetail
            dealId={openId}
            personName={(id) => lookups.personMap.get(id)?.display_name}
            propertyTitle={(id) => lookups.propMap.get(id)?.title}
            onChanged={reload}
            onDeleted={() => {
              closeDetail();
              void reload();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function DealCard({
  deal,
  person,
  property,
  highlighted,
  onOpen,
}: {
  deal: Deal;
  person?: Person;
  property?: PropertyListItem;
  highlighted: boolean;
  onOpen: () => void;
}) {
  const s = stage(deal.status);
  const pct = progress(deal.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-full w-full flex-col items-stretch gap-3 rounded-[16px] bg-card p-3.5 text-start shadow-sm transition hairline hover:border-border-strong",
        highlighted && "border-primary ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{deal.title}</p>
          <Code className="mt-0.5">{deal.code}</Code>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span className="flex items-center gap-1">
          <UserRound className="size-3.5" aria-hidden />
          {person?.display_name ?? `مشتری #${faNum(deal.customer_id)}`}
        </span>
        {deal.property_id ? (
          <span className="flex min-w-0 items-center gap-1">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{property?.title ?? `ملک #${faNum(deal.property_id)}`}</span>
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <motion.div
            className={cn("h-full rounded-full", deal.status === "closed_lost" ? "bg-danger/60" : "bg-gradient-primary")}
            initial={false}
            animate={{ width: deal.status === "closed_lost" ? "100%" : `${Math.max(pct * 100, 4)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="tnum text-body font-bold">{compactToman(deal.amount, "بدون مبلغ")}</span>
      </div>
    </button>
  );
}

function DealDetail({
  dealId,
  personName,
  propertyTitle,
  onChanged,
  onDeleted,
}: {
  dealId: number;
  personName: (id: number) => string | undefined;
  propertyTitle: (id: number) => string | undefined;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const deal = useApi(() => api.getDeal(dealId), [dealId]);
  const history = useApi(() => api.getDealHistory(dealId), [dealId]);
  const [busy, setBusy] = useState<DealStatus | null>(null);
  const confirm = useConfirm();

  const move = async (to: DealStatus) => {
    if (!deal.data) return;
    if (to === "closed_lost") {
      const ok = await confirm({ title: "بستن معامله به‌عنوان ناموفق؟", description: "می‌توانید بعداً آن را دوباره به «سرنخ» برگردانید.", confirmLabel: "ناموفق شد", destructive: true });
      if (!ok) return;
    }
    setBusy(to);
    try {
      // List responses don't carry `version` — always read the freshest copy first.
      const fresh = await api.getDeal(dealId);
      const updated = await api.updateDeal(dealId, { status: to, version: fresh.version ?? 1 });
      deal.setData(updated);
      toast.success(`مرحله به «${dealStageLabel(to)}» تغییر کرد`);
      history.reload();
      invalidate("deals", "dashboard");
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.code === "VERSION_CONFLICT")) {
        toast.warning("این معامله هم‌زمان توسط شخص دیگری تغییر کرده؛ اطلاعات تازه شد");
        deal.reload();
        history.reload();
      } else {
        toast.error(errorMessage(err, "تغییر مرحله ناموفق بود"));
      }
    } finally {
      setBusy(null);
    }
  };

  const can = useCan();
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    const ok = await confirm({ title: "حذف معامله؟", description: "معامله و تاریخچه آن از فهرست حذف می‌شود.", confirmLabel: "حذف", destructive: true });
    if (!ok) return;
    setDeleting(true);
    try {
      const fresh = await api.getDeal(dealId);
      await api.deleteDeal(dealId, fresh.version ?? undefined);
      toast.success("معامله حذف شد");
      invalidate("deals", "dashboard");
      onDeleted();
    } catch (err) {
      toast.error(errorMessage(err, "حذف معامله ناموفق بود"));
    } finally {
      setDeleting(false);
    }
  };

  const d = deal.data;
  const next = d ? nextStage(d.status) : null;
  const canLose = d ? DEAL_TRANSITIONS[d.status as DealStatus]?.includes("closed_lost") : false;
  const canReopen = d?.status === "closed_lost";
  const currentIdx = d ? DEAL_PIPELINE.indexOf(d.status as DealStatus) : -1;

  return (
    <DialogContent
      title={d?.title ?? "جزئیات معامله"}
      description={d ? <Code>{d.code}</Code> : undefined}
      size="lg"
      footer={
        d && (next || canLose || canReopen) ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {canLose ? (
              <Button variant="ghost" className="text-danger" onClick={() => move("closed_lost")} loading={busy === "closed_lost"} disabled={busy !== null}>
                <XCircle aria-hidden /> ناموفق
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button onClick={() => move(next)} loading={busy === next} disabled={busy !== null} size="lg">
                مرحله بعد: {dealStageLabel(next)} <ArrowLeft aria-hidden />
              </Button>
            )}
            {canReopen && (
              <Button variant="secondary" onClick={() => move("lead")} loading={busy === "lead"} disabled={busy !== null}>
                بازگشایی به‌عنوان سرنخ
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {deal.loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      ) : deal.error || !d ? (
        <ErrorState error={deal.error} onRetry={deal.reload} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Stage stepper */}
          <ol className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="مراحل معامله">
            {DEAL_PIPELINE.map((st, i) => {
              const done = currentIdx >= 0 && i < currentIdx;
              const current = st === d.status;
              return (
                <li
                  key={st}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-w-[76px] flex-1 flex-col items-center gap-1.5 rounded-[12px] px-1.5 py-2 text-center text-caption",
                    current ? "bg-primary-soft font-bold text-primary" : done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                      current ? "bg-primary text-primary-foreground" : done ? "bg-success text-white" : "bg-muted",
                    )}
                  >
                    {done ? <Check className="size-3.5" aria-hidden /> : faNum(i + 1)}
                  </span>
                  {DEAL_STAGES[st].label}
                </li>
              );
            })}
          </ol>
          {CLOSED.has(d.status) && d.status !== "closed_won" && (
            <Badge tone={stage(d.status).tone} className="self-start">
              وضعیت فعلی: {stage(d.status).label}
            </Badge>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-[14px] bg-card-2 p-3.5 hairline">
            <KeyValue label="مبلغ" value={<span className="tnum">{formatToman(d.amount, "—")}</span>} />
            <KeyValue label="کمیسیون" value={<span className="tnum">{formatToman(d.commission_total, "—")}</span>} />
            <KeyValue label="مشتری" value={personName(d.customer_id) ?? `#${faNum(d.customer_id)}`} />
            <KeyValue label="ملک" value={d.property_id ? propertyTitle(d.property_id) ?? `#${faNum(d.property_id)}` : "—"} />
            <KeyValue label="ایجاد" value={formatDateTime(d.created_at)} />
            <KeyValue label="لینک" value={<CopyButton text={`${window.location.origin}/d/${d.code}`} label="کپی لینک" size="sm" variant="ghost" success="لینک معامله کپی شد" />} />
          </div>

          <div className="flex flex-col gap-3">
            <SectionTitle>
              <span className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" aria-hidden /> تاریخچه مراحل
              </span>
            </SectionTitle>
            {history.loading ? (
              <RowSkeleton count={2} />
            ) : history.error ? (
              <ErrorState error={history.error} onRetry={history.reload} />
            ) : !history.data || history.data.length === 0 ? (
              <p className="text-body text-muted-foreground">هنوز تغییری ثبت نشده.</p>
            ) : (
              <Timeline
                items={[...history.data].reverse().map((h) => ({
                  id: h.id,
                  title: h.from_status ? `${dealStageLabel(h.from_status)} ← ${dealStageLabel(h.to_status)}` : `ایجاد با مرحله «${dealStageLabel(h.to_status)}»`,
                  meta: `${relativeTime(h.created_at)} · ${formatDateTime(h.created_at)}`,
                  body: h.notes ?? undefined,
                  tone: h.to_status === "closed_won" ? "success" : h.to_status === "closed_lost" ? "danger" : "primary",
                }))}
              />
            )}
          </div>
          {can("deal:delete") && (
            <Button variant="ghost" size="sm" className="self-start text-danger" onClick={remove} loading={deleting}>
              <Trash2 aria-hidden /> حذف معامله
            </Button>
          )}
        </div>
      )}
    </DialogContent>
  );
}

const numeric = z.string().trim().refine((v) => v === "" || (parseNumber(v) ?? -1) >= 0, "عدد معتبر وارد کنید");
const schema = z.object({
  title: z.string().trim().min(2, "عنوان حداقل ۲ حرف").max(200),
  customer_id: z.string().min(1, "مشتری را انتخاب کنید"),
  property_id: z.string(),
  amount: numeric,
  commission_total: numeric,
  notes: z.string().max(2000),
});
type Values = z.infer<typeof schema>;
const NONE = "none";

function DealForm({ properties, persons, onDone }: { properties: PropertyListItem[]; persons: Person[]; onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", customer_id: "", property_id: NONE, amount: "", commission_total: "", notes: "" },
  });
  const amount = parseNumber(useWatch({ control, name: "amount" }));
  const commission = parseNumber(useWatch({ control, name: "commission_total" }));

  const onSubmit = handleSubmit(async (v) => {
    const total = parseNumber(v.commission_total);
    try {
      const created = await api.createDeal({
        title: v.title,
        customer_id: Number(v.customer_id),
        property_id: v.property_id && v.property_id !== NONE ? Number(v.property_id) : null,
        amount: parseNumber(v.amount),
        commission_total: total,
        commission_agent_share: total !== null ? Math.floor(total / 2) : null,
        commission_office_share: total !== null ? total - Math.floor(total / 2) : null,
        status: "lead",
        notes: v.notes || null,
      });
      toast.success(`معامله ${created.code} ثبت شد`);
      invalidate("deals", "dashboard");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "خطا در ثبت معامله"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <Field label="عنوان" error={errors.title?.message} required>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} placeholder="مثلاً خرید آپارتمان مرداویج" {...register("title")} />}
      </Field>
      <Field label="مشتری" error={errors.customer_id?.message} required>
        {(id) => (
          <Controller
            control={control}
            name="customer_id"
            render={({ field }) => (
              <Select
                id={id}
                invalid={!!errors.customer_id}
                value={field.value}
                onValueChange={field.onChange}
                placeholder={persons.length ? "انتخاب مشتری" : "ابتدا مشتری ثبت کنید"}
                options={persons.map((p) => ({ value: String(p.id), label: p.display_name, hint: p.phone ?? undefined }))}
              />
            )}
          />
        )}
      </Field>
      <Field label="ملک">
        {(id) => (
          <Controller
            control={control}
            name="property_id"
            render={({ field }) => (
              <Select id={id} value={field.value} onValueChange={field.onChange} options={[{ value: NONE, label: "بدون ملک" }, ...properties.map((p) => ({ value: String(p.id), label: p.title }))]} />
            )}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="مبلغ (تومان)" error={errors.amount?.message} hint={amount ? compactToman(amount) : undefined}>
          {(id, d) => <Input id={id} inputMode="numeric" className="tnum" aria-describedby={d} {...register("amount")} />}
        </Field>
        <Field label="کمیسیون کل" error={errors.commission_total?.message} hint={commission ? `سهم مشاور/دفتر: ${compactToman(Math.floor(commission / 2))}` : undefined}>
          {(id, d) => <Input id={id} inputMode="numeric" className="tnum" aria-describedby={d} {...register("commission_total")} />}
        </Field>
      </div>
      <Field label="یادداشت">
        {(id) => <Textarea id={id} placeholder="اختیاری" {...register("notes")} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        ثبت معامله
      </Button>
    </form>
  );
}
