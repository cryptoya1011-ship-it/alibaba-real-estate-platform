import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ClipboardList, Phone, Plus, RotateCw, Sparkles, Users } from "lucide-react";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useMisc";
import { useCreateParam } from "@/hooks/useCreateParam";
import type { AIMatch, CustomerRequest, Person, PersonRole } from "@/lib/types";
import { CITIES, PERSON_ROLES, PROPERTY_TYPES, TRANSACTION_TYPES, cityName, personRoleLabel, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum, parseNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Avatar, PageHeader, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { Fab } from "@/components/ui/fab";
import { MatchList } from "@/features/ai/MatchList";
import { cn } from "@/lib/cn";

const ALL = "all";

export default function CrmPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState(ALL);
  const [createOpen, setCreateOpen] = useCreateParam();
  const [matchFor, setMatchFor] = useState<Person | null>(null);
  const [requestFor, setRequestFor] = useState<Person | null>(null);
  const dq = useDebounced(q, 300);
  const params = useMemo(() => ({ limit: 50, q: dq.trim() || undefined, role: role === ALL ? undefined : role }), [dq, role]);
  const { data, error, loading, reload, refreshing } = useApi(() => api.listPersons(params), [params], { keys: ["persons"] });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Users}
        title="مشتریان"
        description={data ? `${faNum(data.length)} مشتری ثبت‌شده` : "خریداران، مالکان و مستأجران"}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
              <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> مشتری جدید
            </Button>
          </>
        }
      />
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <SearchInput value={q} onChange={setQ} placeholder="جستجوی نام یا موبایل…" />
        <Select aria-label="نقش" value={role} onValueChange={setRole} options={[{ value: ALL, label: "همه نقش‌ها" }, ...PERSON_ROLES]} />
      </div>

      {loading ? (
        <RowSkeleton count={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={dq || role !== ALL ? "کسی پیدا نشد" : "هنوز مشتری ثبت نشده"}
          description="مشتریان را ثبت کنید تا برایشان درخواست بسازید و املاک مناسب را خودکار تطبیق دهید."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> مشتری جدید
            </Button>
          }
        />
      ) : (
        <StaggerList className="grid gap-2.5 md:grid-cols-2">
          {data.map((p) => (
            <StaggerItem key={p.id}>
              <PersonCard person={p} onMatch={() => setMatchFor(p)} onRequest={() => setRequestFor(p)} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <Fab label="مشتری جدید" onClick={() => setCreateOpen(true)} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="مشتری جدید" description="اطلاعات تماس و نقش شخص">
          <PersonForm onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={requestFor !== null} onOpenChange={(o) => !o && setRequestFor(null)}>
        {requestFor && (
          <DialogContent title="ثبت درخواست ملک" description={`برای ${requestFor.display_name}`}>
            <RequestForm person={requestFor} onDone={() => setRequestFor(null)} />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={matchFor !== null} onOpenChange={(o) => !o && setMatchFor(null)}>
        {matchFor && (
          <DialogContent title="تطبیق درخواست‌ها" description={`املاک مناسب برای ${matchFor.display_name}`} size="lg">
            <MatchPanel
              person={matchFor}
              onCreateRequest={() => {
                setRequestFor(matchFor);
                setMatchFor(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function PersonCard({ person, onMatch, onRequest }: { person: Person; onMatch: () => void; onRequest: () => void }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[16px] bg-card p-3.5 hairline shadow-sm transition hover:border-border-strong">
      <div className="flex items-center gap-3">
        <Avatar name={person.display_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.display_name}</p>
          {person.phone ? (
            <a href={`tel:${person.phone}`} className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-primary">
              <Phone className="size-3.5" aria-hidden />
              <span dir="ltr" className="font-mono">{person.phone}</span>
            </a>
          ) : (
            <span className="text-caption text-muted-foreground">بدون شماره</span>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {person.roles.map((r) => (
            <Badge key={r.role} tone="primary">
              {personRoleLabel(r.role)}
            </Badge>
          ))}
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={onRequest}>
          <ClipboardList aria-hidden /> درخواست جدید
        </Button>
        <Button size="sm" variant="soft" onClick={onMatch}>
          <Sparkles aria-hidden /> تطبیق درخواست‌ها
        </Button>
      </div>
    </div>
  );
}

const personSchema = z.object({
  first_name: z.string().trim().min(1, "نام الزامی است").max(100),
  last_name: z.string().trim().max(100),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || /^[+0-9۰-۹\s-]{7,}$/.test(v), "شماره معتبر نیست"),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "ایمیل معتبر نیست"),
  role: z.string().min(1),
  notes: z.string().max(2000),
});
type PersonValues = z.infer<typeof personSchema>;

function PersonForm({ onDone }: { onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: { first_name: "", last_name: "", phone: "", email: "", role: "buyer", notes: "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      const created = await api.createPerson({
        first_name: v.first_name,
        last_name: v.last_name || null,
        phone: v.phone ? v.phone.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))) : null,
        email: v.email || null,
        notes: v.notes || null,
        roles: [v.role as PersonRole],
      });
      toast.success(`مشتری «${created.display_name}» ثبت شد`);
      invalidate("persons", "dashboard");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "خطا در ثبت مشتری"));
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="نام" error={errors.first_name?.message} required>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.first_name} {...register("first_name")} />}
        </Field>
        <Field label="نام خانوادگی">
          {(id) => <Input id={id} {...register("last_name")} />}
        </Field>
      </div>
      <Field label="موبایل" error={errors.phone?.message}>
        {(id, d) => <Input id={id} ltr inputMode="tel" aria-describedby={d} aria-invalid={!!errors.phone} placeholder="09131234567" {...register("phone")} />}
      </Field>
      <Field label="ایمیل" error={errors.email?.message}>
        {(id, d) => <Input id={id} ltr inputMode="email" aria-describedby={d} aria-invalid={!!errors.email} placeholder="اختیاری" {...register("email")} />}
      </Field>
      <Field label="نقش">
        {(id) => (
          <Controller control={control} name="role" render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={PERSON_ROLES} />} />
        )}
      </Field>
      <Field label="یادداشت">
        {(id) => <Textarea id={id} placeholder="اختیاری" {...register("notes")} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        ثبت مشتری
      </Button>
    </form>
  );
}

const numeric = z.string().trim().refine((v) => v === "" || parseNumber(v) !== null, "فقط عدد");
const requestSchema = z.object({
  transaction_type: z.string(),
  property_type: z.string(),
  city_code: z.string(),
  district_code: z.string().trim().max(8),
  budget_max: numeric,
  area_min: numeric,
  rooms: numeric,
  special_requirements: z.string().max(1000),
});
type RequestValues = z.infer<typeof requestSchema>;

function RequestForm({ person, onDone }: { person: Person; onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { transaction_type: "sale", property_type: "apartment", city_code: "ISF", district_code: "", budget_max: "", area_min: "", rooms: "", special_requirements: "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.createRequest({
        person_id: person.id,
        transaction_type: v.transaction_type,
        property_type: v.property_type,
        city_code: v.city_code,
        city: CITIES.find((c) => c.code === v.city_code)?.name ?? null,
        district_code: v.district_code ? v.district_code.toUpperCase() : null,
        budget_max: parseNumber(v.budget_max),
        area_min: parseNumber(v.area_min),
        rooms: parseNumber(v.rooms),
        special_requirements: v.special_requirements || null,
      });
      toast.success("درخواست ثبت شد؛ اکنون می‌توانید تطبیق بگیرید");
      invalidate("requests");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "ثبت درخواست ناموفق بود"));
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع معامله">
          {(id) => <Controller control={control} name="transaction_type" render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={TRANSACTION_TYPES} />} />}
        </Field>
        <Field label="نوع ملک">
          {(id) => <Controller control={control} name="property_type" render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={PROPERTY_TYPES} />} />}
        </Field>
        <Field label="شهر">
          {(id) => (
            <Controller
              control={control}
              name="city_code"
              render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={CITIES.map((c) => ({ value: c.code, label: c.name }))} />}
            />
          )}
        </Field>
        <Field label="کد محله" error={errors.district_code?.message}>
          {(id) => <Input id={id} ltr placeholder="MJ" {...register("district_code")} />}
        </Field>
        <Field label="حداکثر بودجه (تومان)" error={errors.budget_max?.message}>
          {(id) => <Input id={id} inputMode="numeric" className="tnum" placeholder="۲۰۰۰۰۰۰۰۰۰۰" {...register("budget_max")} />}
        </Field>
        <Field label="حداقل متراژ" error={errors.area_min?.message}>
          {(id) => <Input id={id} inputMode="numeric" className="tnum" placeholder="۱۰۰" {...register("area_min")} />}
        </Field>
      </div>
      <Field label="تعداد اتاق" error={errors.rooms?.message}>
        {(id) => <Input id={id} inputMode="numeric" className="tnum" placeholder="اختیاری" {...register("rooms")} />}
      </Field>
      <Field label="نیازهای خاص">
        {(id) => <Textarea id={id} placeholder="مثلاً نزدیک مترو، طبقه بالا…" {...register("special_requirements")} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        ثبت درخواست
      </Button>
    </form>
  );
}

/** listRequests(person) → aiMatchRequest(request) */
function MatchPanel({ person, onCreateRequest }: { person: Person; onCreateRequest: () => void }) {
  const reqs = useApi(() => api.listRequests({ person_id: person.id }), [person.id], { keys: ["requests"] });
  const [selected, setSelected] = useState<number | null>(null);
  const [matches, setMatches] = useState<AIMatch[] | null>(null);
  const [matching, setMatching] = useState(false);

  const run = async (r: CustomerRequest) => {
    setSelected(r.id);
    setMatching(true);
    setMatches(null);
    try {
      setMatches(await api.aiMatchRequest(r.id));
    } catch (err) {
      toast.error(errorMessage(err, "تطبیق ناموفق بود"));
    } finally {
      setMatching(false);
    }
  };

  if (reqs.loading) return <RowSkeleton count={2} />;
  if (reqs.error) return <ErrorState error={reqs.error} onRetry={reqs.reload} />;
  const list = reqs.data ?? [];
  if (list.length === 0)
    return (
      <EmptyState
        icon={ClipboardList}
        title="درخواستی برای این مشتری نیست"
        description="ابتدا یک درخواست (نوع ملک، بودجه، متراژ…) ثبت کنید تا املاک مطابق پیدا شوند."
        action={
          <Button onClick={onCreateRequest}>
            <Plus aria-hidden /> ثبت درخواست
          </Button>
        }
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {list.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => run(r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[14px] p-3 text-start transition hairline",
                selected === r.id ? "border-primary/50 bg-primary-soft" : "bg-card-2 hover:bg-muted",
              )}
            >
              <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {propertyTypeLabel(r.property_type)} · {transactionLabel(r.transaction_type)} · {cityName(r.city_code)}
                </span>
                <span className="tnum text-caption text-muted-foreground">بودجه تا {compactToman(r.budget_max, "نامشخص")}</span>
              </span>
              <span className="flex items-center gap-1 text-caption font-semibold text-primary">
                <Sparkles className="size-4" aria-hidden /> تطبیق
              </span>
            </button>
          </li>
        ))}
      </ul>
      {matching && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {matches && <MatchList matches={matches} />}
      <Button variant="ghost" onClick={onCreateRequest}>
        <Plus aria-hidden /> درخواست دیگر
      </Button>
    </div>
  );
}
