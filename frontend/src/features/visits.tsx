import { useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, CalendarPlus, Clock, MapPin } from "lucide-react";
import { ApiError, api } from "../api";
import { faDate, faNum } from "../lib/format";
import { useData } from "../state/data";
import { Badge, Button, Card, Code, EmptyState, Field, Input, ListSkeleton, Modal, PageHead, Select, Stat } from "../components/ui";
import { toast } from "sonner";

const STATUS_TONE: Record<string, "brand" | "ok" | "warn" | "danger" | "muted"> = {
  scheduled: "brand",
  confirmed: "ok",
  done: "ok",
  completed: "ok",
  canceled: "danger",
  no_show: "danger",
};

const STATUS_FA: Record<string, string> = {
  scheduled: "زمان‌بندی شده",
  confirmed: "تأیید شده",
  done: "انجام شده",
  completed: "انجام شده",
  canceled: "لغو شده",
  no_show: "عدم حضور",
};

export default function VisitsPage() {
  const { visits, properties, persons, reload, loading } = useData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    customer_id: "",
    visit_date: new Date().toISOString().slice(0, 10),
    visit_time: "10:00",
    notes: "",
  });

  const propMap = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const personMap = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const submit = async () => {
    if (!form.property_id || !form.customer_id) {
      toast.error("انتخاب ملک و مشتری الزامی است");
      return;
    }
    setBusy(true);
    try {
      await api.createVisit({
        property_id: Number(form.property_id),
        customer_id: Number(form.customer_id),
        visit_date: form.visit_date,
        visit_time: form.visit_time,
        status: "scheduled",
        notes: form.notes || "بازدید ثبت‌شده از پنل",
      });
      toast.success("بازدید ثبت شد و اعلان ساخته شد");
      setForm({ ...form, property_id: "", customer_id: "", notes: "" });
      setOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت بازدید");
    } finally {
      setBusy(false);
    }
  };

  const upcoming = visits.filter((v) => v.status === "scheduled" || v.status === "confirmed").length;

  return (
    <div className="animate-fade-in">
      <PageHead
        title="بازدیدها"
        desc="زمان‌بندی بازدید ملک — هر بازدید یک اعلان می‌سازد"
        icon={<CalendarDays className="h-5 w-5" />}
        action={
          <Button size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            بازدید جدید
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="کل بازدیدها" value={faNum(visits.length)} icon={<CalendarDays className="h-4 w-4" />} />
        <Stat label="در انتظار" value={faNum(upcoming)} tone="warn" icon={<Clock className="h-4 w-4" />} />
        <Stat label="انجام‌شده" value={faNum(visits.filter((v) => ["done", "completed"].includes(v.status)).length)} tone="ok" icon={<CalendarCheck className="h-4 w-4" />} />
      </div>

      {loading && visits.length === 0 ? (
        <ListSkeleton />
      ) : visits.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="بازدیدی ثبت نشده"
          desc="برای مشتریان خود بازدید زمان‌بندی کنید تا پیگیری منظم داشته باشید."
          action={
            <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              زمان‌بندی بازدید
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {visits.map((v, i) => {
            const prop = propMap.get(v.property_id);
            const person = personMap.get(v.customer_id);
            return (
              <li key={v.id} style={{ animationDelay: `${Math.min(i * 30, 250)}ms` }} className="animate-slide-up">
                <Card className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-raised bg-raise">
                    <CalendarDays className="h-4 w-4 text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold">{prop?.title ?? `ملک #${v.property_id}`}</span>
                      <Badge tone={STATUS_TONE[v.status] ?? "muted"}>{STATUS_FA[v.status] ?? v.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {faDate(v.visit_date)} {v.visit_time ? `— ساعت ${v.visit_time}` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {person?.display_name ?? `مشتری #${v.customer_id}`}
                      </span>
                      {prop?.code && <Code>{prop.code}</Code>}
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
        aria-label="بازدید جدید"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop transition active:scale-95 sm:hidden dark:text-slate-900"
      >
        <CalendarPlus className="h-6 w-6" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="زمان‌بندی بازدید">
        <div className="space-y-4">
          <Field label="ملک">
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">— انتخاب ملک —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="مشتری">
            <Select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">— انتخاب مشتری —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ">
              <Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
            </Field>
            <Field label="ساعت">
              <Input type="time" value={form.visit_time} onChange={(e) => setForm({ ...form, visit_time: e.target.value })} />
            </Field>
          </div>
          <Field label="یادداشت (اختیاری)">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="هماهنگی با مالک…" />
          </Field>
          <Button className="w-full" size="lg" loading={busy} onClick={submit}>
            ثبت بازدید + ساخت اعلان
          </Button>
        </div>
      </Modal>
    </div>
  );
}
