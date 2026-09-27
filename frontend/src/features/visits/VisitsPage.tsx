import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BellRing, Building2, CalendarClock, Clock, Plus, RotateCw, UserRound } from "lucide-react";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useCreateParam } from "@/hooks/useCreateParam";
import { useLookups } from "@/hooks/useLookups";
import type { Person, PropertyListItem, Visit } from "@/lib/types";
import { VISIT_STATUSES } from "@/lib/constants";
import { faNum, formatTime, formatWeekdayDate, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { PageHeader, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { Fab } from "@/components/ui/fab";

type Filter = "all" | "today" | "upcoming" | "past";

export default function VisitsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useCreateParam();
  const { data, error, loading, reload, refreshing } = useApi(() => api.listVisits({ limit: 100 }), [], { keys: ["visits"] });
  const lookups = useLookups();
  const today = todayISO();

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      all: list.length,
      today: list.filter((v) => v.visit_date === today).length,
      upcoming: list.filter((v) => v.visit_date > today).length,
      past: list.filter((v) => v.visit_date < today).length,
    };
  }, [data, today]);

  const visible = useMemo(() => {
    const list = [...(data ?? [])].sort((a, b) => (a.visit_date + (a.visit_time ?? "")).localeCompare(b.visit_date + (b.visit_time ?? "")));
    if (filter === "today") return list.filter((v) => v.visit_date === today);
    if (filter === "upcoming") return list.filter((v) => v.visit_date > today);
    if (filter === "past") return list.filter((v) => v.visit_date < today).reverse();
    return list;
  }, [data, filter, today]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={CalendarClock}
        title="بازدیدها"
        description="برنامه بازدید مشتریان از املاک"
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
              <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> بازدید جدید
            </Button>
          </>
        }
      />
      <Segmented<Filter>
        aria-label="فیلتر زمان"
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: "همه", count: counts.all },
          { value: "today", label: "امروز", count: counts.today },
          { value: "upcoming", label: "پیش رو", count: counts.upcoming },
          { value: "past", label: "گذشته", count: counts.past },
        ]}
      />

      {loading ? (
        <RowSkeleton count={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={filter === "all" ? "هنوز بازدیدی ثبت نشده" : "بازدیدی در این بازه نیست"}
          description="با ثبت بازدید، اعلان یادآوری برای مشاور ساخته می‌شود."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> بازدید جدید
            </Button>
          }
        />
      ) : (
        <StaggerList className="grid gap-2.5 md:grid-cols-2">
          {visible.map((v) => (
            <StaggerItem key={v.id}>
              <VisitCard visit={v} property={lookups.propMap.get(v.property_id)} person={lookups.personMap.get(v.customer_id)} isToday={v.visit_date === today} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <Fab label="بازدید جدید" onClick={() => setCreateOpen(true)} />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="بازدید جدید" description="برای مشاور مسئول اعلان ساخته می‌شود">
          <VisitForm properties={lookups.properties} persons={lookups.persons} onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisitCard({ visit, property, person, isToday }: { visit: Visit; property?: PropertyListItem; person?: Person; isToday: boolean }) {
  const status = VISIT_STATUSES[visit.status] ?? { label: visit.status, tone: "neutral" as const };
  const date = new Date(`${visit.visit_date}T00:00:00`);
  const day = new Intl.DateTimeFormat("fa-IR", { day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat("fa-IR", { month: "short" }).format(date);
  return (
    <div className="flex h-full gap-3 rounded-[16px] bg-card p-3.5 hairline shadow-sm">
      <div className={isToday ? "flex w-14 shrink-0 flex-col items-center justify-center rounded-[12px] bg-gradient-primary text-primary-foreground" : "flex w-14 shrink-0 flex-col items-center justify-center rounded-[12px] bg-muted"}>
        <span className="tnum text-display font-extrabold leading-none">{day}</span>
        <span className="text-caption">{month}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 font-semibold">
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{property?.title ?? `ملک #${faNum(visit.property_id)}`}</span>
          </p>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="flex items-center gap-1.5 text-body text-muted-foreground">
          <UserRound className="size-4 shrink-0" aria-hidden />
          {person?.display_name ?? `مشتری #${faNum(visit.customer_id)}`}
        </p>
        <p className="tnum flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {formatWeekdayDate(visit.visit_date)}
          {visit.visit_time ? ` · ساعت ${formatTime(visit.visit_time)}` : ""}
          {isToday && <Badge tone="primary" className="ms-1">امروز</Badge>}
        </p>
      </div>
    </div>
  );
}

const schema = z.object({
  property_id: z.string().min(1, "ملک را انتخاب کنید"),
  customer_id: z.string().min(1, "مشتری را انتخاب کنید"),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ را انتخاب کنید"),
  visit_time: z.string(),
  notes: z.string().max(1000),
});
type Values = z.infer<typeof schema>;

function VisitForm({ properties, persons, onDone }: { properties: PropertyListItem[]; persons: Person[]; onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { property_id: "", customer_id: "", visit_date: todayISO(), visit_time: "10:00", notes: "" },
  });
  const date = useWatch({ control, name: "visit_date" });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.createVisit({
        property_id: Number(v.property_id),
        customer_id: Number(v.customer_id),
        visit_date: v.visit_date,
        visit_time: v.visit_time || null,
        status: "scheduled",
        notes: v.notes || "بازدید از PWA",
      });
      toast.success("بازدید ثبت شد و اعلان برای مشاور ساخته شد", { icon: <BellRing className="size-4" /> });
      invalidate("visits", "notifications", "dashboard");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "خطا در ثبت بازدید"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <Field label="ملک" error={errors.property_id?.message} required>
        {(id) => (
          <Controller
            control={control}
            name="property_id"
            render={({ field }) => (
              <Select
                id={id}
                invalid={!!errors.property_id}
                value={field.value}
                onValueChange={field.onChange}
                placeholder={properties.length ? "انتخاب ملک" : "ابتدا ملک ثبت کنید"}
                options={properties.map((p) => ({ value: String(p.id), label: p.title }))}
              />
            )}
          />
        )}
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ" error={errors.visit_date?.message} hint={formatWeekdayDate(date, "")}>
          {(id, d) => <Input id={id} type="date" aria-describedby={d} {...register("visit_date")} />}
        </Field>
        <Field label="ساعت">
          {(id) => <Input id={id} type="time" {...register("visit_time")} />}
        </Field>
      </div>
      <Field label="یادداشت">
        {(id) => <Textarea id={id} placeholder="اختیاری" {...register("notes")} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        ثبت بازدید
      </Button>
    </form>
  );
}
