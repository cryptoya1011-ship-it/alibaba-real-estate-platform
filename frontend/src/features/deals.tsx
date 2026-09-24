import { useMemo, useState } from "react";
import { ArrowLeft, Handshake, History, TrendingUp } from "lucide-react";
import { ApiError, api } from "../api";
import { cn } from "../lib/cn";
import { DEAL_STAGES, dealStageLabel, faDateTime, faNum, toman } from "../lib/format";
import type { DealItem } from "../lib/types";
import { useData } from "../state/data";
import { Badge, Button, Card, Code, EmptyState, Field, Input, ListSkeleton, Modal, PageHead, Select, Stat } from "../components/ui";
import { toast } from "sonner";

type HistoryRow = { id: number; from_status: string | null; to_status: string; changed_at?: string; notes?: string | null };

export default function DealsPage() {
  const { deals, persons, properties, reload, loading } = useData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [historyFor, setHistoryFor] = useState<DealItem | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    customer_id: "",
    property_id: "",
    amount: 20_000_000_000,
    commission_total: 1_000_000_000,
  });

  const personMap = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const propMap = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const submit = async () => {
    if (!form.title.trim() || !form.customer_id) {
      toast.error("عنوان و مشتری الزامی است");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createDeal({
        title: form.title.trim(),
        customer_id: Number(form.customer_id),
        property_id: form.property_id ? Number(form.property_id) : null,
        amount: Number(form.amount),
        commission_total: Number(form.commission_total),
        commission_agent_share: Number(form.commission_total) / 2,
        commission_office_share: Number(form.commission_total) / 2,
        status: "lead",
      });
      toast.success(`معامله ثبت شد — کد ${created.code}`);
      setForm({ title: "", customer_id: "", property_id: "", amount: 20_000_000_000, commission_total: 1_000_000_000 });
      setOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت معامله");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (deal: DealItem) => {
    const idx = DEAL_STAGES.findIndex((s) => s.key === deal.status);
    if (idx < 0) {
      toast.info("این معامله در وضعیت نهایی است");
      return;
    }
    const next = DEAL_STAGES[idx + 1];
    if (!next) {
      toast.info("معامله در مرحله پایانی پایپ‌لاین است");
      return;
    }
    setAdvancing(deal.id);
    try {
      await api.updateDeal(deal.id, { status: next.key, version: deal.version ?? 1 });
      toast.success(`به مرحله «${next.label}» منتقل شد`);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("نسخه معامله تغییر کرده — لیست تازه شد. دوباره تلاش کنید.");
        await reload();
      } else {
        toast.error(err instanceof ApiError ? err.message : "خطا در تغییر مرحله");
      }
    } finally {
      setAdvancing(null);
    }
  };

  const openHistory = async (deal: DealItem) => {
    setHistoryFor(deal);
    setHistoryLoading(true);
    try {
      setHistory((await api.getDealHistory(deal.id)) as HistoryRow[]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در دریافت تاریخچه");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openTotal = deals.filter((d) => d.status !== "closed_won" && d.status !== "closed_lost");
  const wonTotal = deals.filter((d) => d.status === "closed_won").reduce((s, d) => s + (d.amount ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <PageHead
        title="معاملات"
        desc="پایپ‌لاین فروش — سرنخ تا قطعی‌شدن با قفل نسخه (Optimistic Locking)"
        icon={<Handshake className="h-5 w-5" />}
        action={
          <Button size="sm" icon={<TrendingUp className="h-4 w-4" />} onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            معامله جدید
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="کل معاملات" value={faNum(deals.length)} icon={<Handshake className="h-4 w-4" />} />
        <Stat label="در جریان" value={faNum(openTotal.length)} tone="warn" icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="قطعی‌شده" value={toman(wonTotal)} tone="ok" icon={<Handshake className="h-4 w-4" />} />
      </div>

      {loading && deals.length === 0 ? (
        <ListSkeleton />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-6 w-6" />}
          title="معامله‌ای ثبت نشده"
          desc="با ثبت معامله، مسیر فروش را مرحله‌به‌مرحله پیش ببرید."
          action={
            <Button icon={<TrendingUp className="h-4 w-4" />} onClick={() => setOpen(true)}>
              ثبت معامله
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {deals.map((d, i) => {
            const stageIdx = DEAL_STAGES.findIndex((s) => s.key === d.status);
            const isLost = d.status === "closed_lost";
            const progress = isLost ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DEAL_STAGES.length) * 100 : 0;
            const person = personMap.get(d.customer_id);
            const prop = d.property_id ? propMap.get(d.property_id) : undefined;
            return (
              <li key={d.id} style={{ animationDelay: `${Math.min(i * 30, 250)}ms` }} className="animate-slide-up">
                <Card className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">{d.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
                        <Code>{d.code}</Code>
                        <span>{person?.display_name ?? `مشتری #${d.customer_id}`}</span>
                        {prop && <span className="truncate">• {prop.title}</span>}
                      </div>
                    </div>
                    <Badge tone={d.status === "closed_won" ? "ok" : isLost ? "danger" : "brand"}>{dealStageLabel(d.status)}</Badge>
                  </div>

                  {/* Pipeline */}
                  <div className="mb-2 flex items-center gap-1">
                    {DEAL_STAGES.map((s, idx) => (
                      <div
                        key={s.key}
                        title={s.label}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-all duration-500",
                          isLost ? "bg-danger/30" : idx <= stageIdx ? "bg-brand" : "bg-line",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mb-3 text-[10px] text-muted">
                    مرحله {faNum(Math.max(stageIdx + 1, 0))} از {faNum(DEAL_STAGES.length)} — {dealStageLabel(d.status)}
                    <span className="mx-2">•</span>
                    <span className="tnum">مبلغ: {toman(d.amount)}</span>
                    <span className="mx-2">•</span>
                    <span className="tnum">کمیسیون: {toman(d.commission_total)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Button
                      size="sm"
                      variant="soft"
                      icon={<ArrowLeft className="h-3.5 w-3.5" />}
                      loading={advancing === d.id}
                      disabled={isLost || stageIdx === DEAL_STAGES.length - 1}
                      onClick={() => advance(d)}
                    >
                      مرحله بعد
                    </Button>
                    <Button size="sm" variant="outline" icon={<History className="h-3.5 w-3.5" />} onClick={() => openHistory(d)}>
                      تاریخچه
                    </Button>
                    <span className="mx-1 hidden flex-1 sm:block" />
                    <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-line sm:block">
                      <div className="h-full bg-brand/60" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setOpen(true)}
        aria-label="معامله جدید"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop transition active:scale-95 sm:hidden dark:text-slate-900"
      >
        <TrendingUp className="h-6 w-6" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="ثبت معامله جدید">
        <div className="space-y-4">
          <Field label="عنوان معامله">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="معامله آپارتمان مرداویج" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مشتری">
              <Select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">— انتخاب —</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ملک (اختیاری)">
              <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
                <option value="">— انتخاب —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مبلغ معامله">
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} dir="ltr" />
            </Field>
            <Field label="کمیسیون کل">
              <Input type="number" value={form.commission_total} onChange={(e) => setForm({ ...form, commission_total: Number(e.target.value) })} dir="ltr" />
            </Field>
          </div>
          <div className="rounded-xl bg-raise p-3 text-[10px] leading-5 text-muted">
            تقسیم پیش‌فرض کمیسیون: <span className="font-bold text-ink">۵۰٪ مشاور / ۵۰٪ دفتر</span> — معادل{" "}
            <span className="font-bold text-brand dark:text-teal-300">{toman(form.commission_total / 2)}</span> برای هر طرف
          </div>
          <Button className="w-full" size="lg" loading={busy} onClick={submit}>
            ثبت معامله — کد DL-…
          </Button>
        </div>
      </Modal>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`تاریخچه معامله ${historyFor?.code ?? ""}`}>
        {historyLoading ? (
          <ListSkeleton />
        ) : history.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="تاریخچه‌ای ثبت نشده" desc="با اولین تغییر مرحله، تاریخچه اینجا نمایش داده می‌شود." />
        ) : (
          <ol className="relative space-y-4 ps-6">
            <span className="absolute inset-y-1 start-2 w-px bg-line" />
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -start-[1.15rem] top-1 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                <div className="text-xs font-medium">
                  {h.from_status ? (
                    <>
                      <span className="text-muted">{dealStageLabel(h.from_status)}</span>
                      <span className="mx-1.5">→</span>
                      <span className="font-bold">{dealStageLabel(h.to_status)}</span>
                    </>
                  ) : (
                    <span className="font-bold">ایجاد — {dealStageLabel(h.to_status)}</span>
                  )}
                </div>
                {h.changed_at && <div className="mt-0.5 text-[10px] text-muted">{faDateTime(h.changed_at)}</div>}
                {h.notes && <div className="mt-1 text-[10px] text-muted">{h.notes}</div>}
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  );
}
