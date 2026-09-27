import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, ClipboardList, Lock, MoreVertical, Pencil, Phone, Plus, RotateCw, Sparkles, Trash2, Unlock, Users } from "lucide-react";
import { api, ApiError } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useMisc";
import { useCreateParam } from "@/hooks/useCreateParam";
import type { AIMatch, CustomerRequest, Person, PersonRole } from "@/lib/types";
import { CITIES, PERSON_ROLES, PROPERTY_TYPES, REQUEST_STATUSES, TRANSACTION_TYPES, cityName, personRoleLabel, propertyTypeLabel, requestStatus, transactionLabel } from "@/lib/constants";
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
import { useConfirm } from "@/components/ui/confirm";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useCan } from "@/hooks/useSession";

const toLatinDigits = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

function versionConflict(err: unknown) {
  return err instanceof ApiError && (err.status === 409 || err.code === "VERSION_CONFLICT");
}

const ALL = "all";

export default function CrmPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState(ALL);
  const [createOpen, setCreateOpen] = useCreateParam();
  const [matchFor, setMatchFor] = useState<Person | null>(null);
  const [requestFor, setRequestFor] = useState<Person | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const confirm = useConfirm();
  const can = useCan();
  const removePerson = async (p: Person) => {
    const ok = await confirm({
      title: `حذف «${p.display_name}»؟`,
      description: "مشتری از فهرست حذف می‌شود. درخواست‌ها، بازدیدها و معاملات ثبت‌شده باقی می‌مانند.",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (!ok) return;
    try {
      const fresh = await api.getPerson(p.id);
      await api.deletePerson(p.id, fresh.version);
      toast.success("مشتری حذف شد");
      invalidate("persons", "dashboard");
    } catch (err) {
      toast.error(errorMessage(err, "حذف مشتری ناموفق بود"));
    }
  };
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
              <PersonCard
                person={p}
                onMatch={() => setMatchFor(p)}
                onRequest={() => setRequestFor(p)}
                onEdit={can("customer:update") ? () => setEditing(p) : undefined}
                onDelete={can("customer:delete") ? () => void removePerson(p) : undefined}
              />
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

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title="ویرایش مشتری" description={editing.display_name}>
            <PersonEditLoader person={editing} onDone={() => setEditing(null)} />
          </DialogContent>
        )}
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

function PersonCard({
  person,
  onMatch,
  onRequest,
  onEdit,
  onDelete,
}: {
  person: Person;
  onMatch: () => void;
  onRequest: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
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
        {(onEdit || onDelete) && (
          <DropdownMenu dir="rtl">
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-me-1 shrink-0" aria-label={`گزینه‌های ${person.display_name}`}>
                <MoreVertical aria-hidden />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              {onEdit && (
                <DropdownItem onSelect={onEdit}>
                  <Pencil /> ویرایش و نقش‌ها
                </DropdownItem>
              )}
              {onEdit && onDelete && <DropdownSeparator />}
              {onDelete && (
                <DropdownItem destructive onSelect={onDelete}>
                  <Trash2 /> حذف مشتری
                </DropdownItem>
              )}
            </DropdownContent>
          </DropdownMenu>
        )}
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
  national_id: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9۰-۹]{10}$/.test(v), "کد ملی باید ۱۰ رقم باشد"),
  roles: z.array(z.string()).min(1, "دست‌کم یک نقش انتخاب کنید"),
  notes: z.string().max(2000),
});
type PersonValues = z.infer<typeof personSchema>;

function RoleChips({ value, onChange, invalid }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", invalid && "rounded-[12px] ring-1 ring-danger/60")} role="group" aria-label="نقش‌ها">
      {PERSON_ROLES.map((r) => {
        const on = value.includes(r.value);
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r.value) : [...value, r.value])}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-body transition hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "border-primary/50 bg-primary-soft font-semibold text-primary" : "bg-card-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {on && <Check className="size-4" aria-hidden />}
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function PersonEditLoader({ person, onDone }: { person: Person; onDone: () => void }) {
  const detail = useApi(() => api.getPerson(person.id), [person.id]);
  if (detail.loading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-24" />
      </div>
    );
  if (detail.error || !detail.data) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  return <PersonForm person={detail.data} onDone={onDone} onConflict={detail.reload} />;
}

function PersonForm({ person, onDone, onConflict }: { person?: Person; onDone: () => void; onConflict?: () => void }) {
  const editing = !!person;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: person
      ? {
          first_name: person.first_name,
          last_name: person.last_name ?? "",
          phone: person.phone ?? "",
          email: person.email ?? "",
          national_id: person.national_id ?? "",
          roles: person.roles.map((r) => r.role),
          notes: person.notes ?? "",
        }
      : { first_name: "", last_name: "", phone: "", email: "", national_id: "", roles: ["buyer"], notes: "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    const fields = {
      first_name: v.first_name,
      last_name: v.last_name || null,
      phone: v.phone ? toLatinDigits(v.phone) : null,
      email: v.email || null,
      national_id: v.national_id ? toLatinDigits(v.national_id) : null,
      notes: v.notes || null,
    };
    try {
      if (person) {
        await api.updatePerson(person.id, { ...fields, version: person.version ?? 1 });
        const before = new Set(person.roles.map((r) => r.role));
        const after = new Set(v.roles);
        for (const r of v.roles) if (!before.has(r)) await api.addPersonRole(person.id, r);
        for (const r of before) if (!after.has(r)) await api.removePersonRole(person.id, r);
        toast.success("اطلاعات مشتری به‌روز شد");
      } else {
        const created = await api.createPerson({ ...fields, roles: v.roles as PersonRole[] });
        toast.success(`مشتری «${created.display_name}» ثبت شد`);
      }
      invalidate("persons", "dashboard");
      onDone();
    } catch (err) {
      if (editing && versionConflict(err)) {
        toast.warning("این مشتری هم‌زمان ویرایش شده بود؛ اطلاعات تازه بارگذاری شد");
        onConflict?.();
      } else toast.error(errorMessage(err, editing ? "ذخیره تغییرات ناموفق بود" : "خطا در ثبت مشتری"));
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ایمیل" error={errors.email?.message}>
          {(id, d) => <Input id={id} ltr inputMode="email" aria-describedby={d} aria-invalid={!!errors.email} placeholder="اختیاری" {...register("email")} />}
        </Field>
        <Field label="کد ملی" error={errors.national_id?.message}>
          {(id, d) => <Input id={id} ltr inputMode="numeric" aria-describedby={d} aria-invalid={!!errors.national_id} placeholder="اختیاری" {...register("national_id")} />}
        </Field>
      </div>
      <Field label="نقش‌ها" error={errors.roles?.message} required>
        {() => <Controller control={control} name="roles" render={({ field }) => <RoleChips value={field.value} onChange={field.onChange} invalid={!!errors.roles} />} />}
      </Field>
      <Field label="یادداشت">
        {(id) => <Textarea id={id} placeholder="اختیاری" {...register("notes")} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        {editing ? "ذخیره تغییرات" : "ثبت مشتری"}
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
  status: z.string(),
});
type RequestValues = z.infer<typeof requestSchema>;

const numStr = (n: number | null | undefined) => (n == null ? "" : String(n));

function RequestForm({ person, request, onDone }: { person: Person; request?: CustomerRequest; onDone: () => void }) {
  const editing = !!request;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: request
      ? {
          transaction_type: request.transaction_type ?? "sale",
          property_type: request.property_type ?? "apartment",
          city_code: request.city_code ?? "ISF",
          district_code: request.district_code ?? "",
          budget_max: numStr(request.budget_max),
          area_min: numStr(request.area_min),
          rooms: numStr(request.rooms),
          special_requirements: request.special_requirements ?? "",
          status: request.status || "active",
        }
      : { transaction_type: "sale", property_type: "apartment", city_code: "ISF", district_code: "", budget_max: "", area_min: "", rooms: "", special_requirements: "", status: "active" },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (request) {
        const version = request.version ?? (await api.getRequest(request.id)).version;
        await api.updateRequest(request.id, {
          transaction_type: v.transaction_type,
          property_type: v.property_type,
          city_code: v.city_code,
          city: CITIES.find((c) => c.code === v.city_code)?.name ?? null,
          district_code: v.district_code ? v.district_code.toUpperCase() : null,
          budget_max: parseNumber(v.budget_max),
          area_min: parseNumber(v.area_min),
          rooms: parseNumber(v.rooms),
          special_requirements: v.special_requirements || null,
          status: v.status,
          version,
        });
        toast.success("درخواست به‌روز شد");
        invalidate("requests");
        onDone();
        return;
      }
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
      if (editing && versionConflict(err)) {
        toast.warning("این درخواست هم‌زمان تغییر کرده بود؛ فهرست تازه شد");
        invalidate("requests");
        onDone();
      } else toast.error(errorMessage(err, editing ? "ذخیره درخواست ناموفق بود" : "ثبت درخواست ناموفق بود"));
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
      {editing && (
        <Field label="وضعیت درخواست">
          {(id) => (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select id={id} value={field.value} onValueChange={field.onChange} options={Object.entries(REQUEST_STATUSES).map(([value, s]) => ({ value, label: s.label }))} />
              )}
            />
          )}
        </Field>
      )}
      <Button type="submit" size="lg" block loading={isSubmitting}>
        {editing ? "ذخیره تغییرات" : "ثبت درخواست"}
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
  const [editReq, setEditReq] = useState<CustomerRequest | null>(null);
  const confirm = useConfirm();
  const can = useCan();
  const canManage = can("customer_request:update");

  const toggleClosed = async (r: CustomerRequest) => {
    const status = r.status === "closed" ? "active" : "closed";
    try {
      const version = r.version ?? (await api.getRequest(r.id)).version;
      await api.updateRequest(r.id, { status, version });
      toast.success(status === "closed" ? "درخواست بسته شد" : "درخواست دوباره فعال شد");
      invalidate("requests");
    } catch (err) {
      if (versionConflict(err)) {
        toast.warning("این درخواست هم‌زمان تغییر کرده بود؛ فهرست تازه شد");
        void reqs.reload();
      } else toast.error(errorMessage(err, "تغییر وضعیت ناموفق بود"));
    }
  };

  const removeReq = async (r: CustomerRequest) => {
    const ok = await confirm({ title: "حذف درخواست؟", description: "این درخواست و تطبیق‌های آن حذف می‌شود.", confirmLabel: "حذف", destructive: true });
    if (!ok) return;
    try {
      const version = r.version ?? (await api.getRequest(r.id)).version;
      await api.deleteRequest(r.id, version);
      if (selected === r.id) {
        setSelected(null);
        setMatches(null);
      }
      toast.success("درخواست حذف شد");
      invalidate("requests");
    } catch (err) {
      toast.error(errorMessage(err, "حذف درخواست ناموفق بود"));
    }
  };

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
          <li
            key={r.id}
            className={cn(
              "flex items-center rounded-[14px] transition hairline",
              selected === r.id ? "border-primary/50 bg-primary-soft" : "bg-card-2 hover:bg-muted",
              r.status === "closed" && "opacity-70",
            )}
          >
            <button type="button" onClick={() => run(r)} className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] p-3 text-start">
              <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {propertyTypeLabel(r.property_type)} · {transactionLabel(r.transaction_type)} · {cityName(r.city_code)}
                </span>
                <span className="tnum flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                  بودجه تا {compactToman(r.budget_max, "نامشخص")}
                  {r.status !== "active" && <Badge tone={requestStatus(r.status).tone}>{requestStatus(r.status).label}</Badge>}
                </span>
              </span>
              <span className="flex items-center gap-1 text-caption font-semibold text-primary">
                <Sparkles className="size-4" aria-hidden /> تطبیق
              </span>
            </button>
            {canManage && (
              <DropdownMenu dir="rtl">
                <DropdownTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="me-2 shrink-0" aria-label="گزینه‌های درخواست">
                    <MoreVertical aria-hidden />
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onSelect={() => setEditReq(r)}>
                    <Pencil /> ویرایش درخواست
                  </DropdownItem>
                  <DropdownItem onSelect={() => void toggleClosed(r)}>
                    {r.status === "closed" ? (
                      <>
                        <Unlock /> فعال‌سازی دوباره
                      </>
                    ) : (
                      <>
                        <Lock /> بستن درخواست
                      </>
                    )}
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem destructive onSelect={() => void removeReq(r)}>
                    <Trash2 /> حذف درخواست
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            )}
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
      <Dialog open={editReq !== null} onOpenChange={(o) => !o && setEditReq(null)}>
        {editReq && (
          <DialogContent title="ویرایش درخواست" description={`برای ${person.display_name}`}>
            <RequestForm person={person} request={editReq} onDone={() => setEditReq(null)} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
