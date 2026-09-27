import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, CloudOff } from "lucide-react";
import { api, addToOutbox, ApiError } from "@/api";
import { invalidate } from "@/hooks/useApi";
import { useOnline } from "@/hooks/useOnline";
import { useCan } from "@/hooks/useSession";
import type { PropertyCreatePayload, PropertyDetail, PropertyStatus, PropertyType, RegistrantType, TransactionType } from "@/lib/types";
import { CITIES, DISTRICTS, PERM_PROPERTY_APPROVE, PROPERTY_STATUSES, PROPERTY_TYPES, SUBMISSION_STATUSES, TRANSACTION_TYPES } from "@/lib/constants";
import { compactToman, faNum, parseNumber, uid } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch";
import { copyText } from "@/components/ui/misc";
import { errorMessage } from "@/components/ui/states";
import { publicUrl } from "./PropertyCard";
import { LocalPhotoPicker, uploadLocalPhotos, type LocalPhoto } from "./PhotoManager";
import {
  AMENITIES,
  AMENITY_GROUP_LABELS,
  AREA_LABELS,
  CORE_FEATURES,
  PRICE_LABEL,
  REGISTRANT_TYPES,
  SPEC_LABELS,
  USAGE_BY_TYPE,
  parseAmenities,
  typeConfig,
  type AreaField,
  type SpecField,
} from "./propertyConfig";

const PERM_OWNER = "property:owner:read";
const PERM_ADDRESS = "property:address:read";

const num = (v: string) => parseNumber(v);
const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === "" || num(v) !== null, "فقط عدد وارد کنید");
const optionalPositive = optionalNumber.refine((v) => v === "" || (num(v) ?? -1) >= 0, "عدد منفی مجاز نیست");

const schema = z
  .object({
    title: z.string().trim().min(3, "عنوان حداقل ۳ حرف باشد").max(300, "عنوان طولانی است"),
    property_type: z.string().min(1, "نوع ملک را انتخاب کنید"),
    transaction_type: z.string().min(1, "نوع معامله را انتخاب کنید"),
    status: z.string().min(1),
    registrant_type: z.string().min(1),
    land_area: optionalPositive,
    built_area: optionalPositive,
    useful_area: optionalPositive,
    floor_area: optionalPositive,
    rooms: optionalPositive,
    bedrooms: optionalPositive,
    bathrooms: optionalPositive,
    floor_number: optionalNumber,
    total_floors: optionalPositive,
    year_built: optionalNumber.refine((v) => {
      if (v === "") return true;
      const y = num(v) ?? 0;
      return (y >= 1250 && y <= 1450) || (y >= 1900 && y <= 2100);
    }, "سال ساخت نامعتبر است (مثلاً ۱۴۰۲)"),
    price: optionalPositive,
    deposit: optionalPositive,
    rent_price: optionalPositive,
    is_exchangeable: z.boolean(),
    exchange_description: z.string().trim().max(2000),
    owner_share: optionalPositive.refine((v) => v === "" || (num(v) ?? 0) <= 100, "حداکثر ۱۰۰ درصد"),
    builder_share: optionalPositive.refine((v) => v === "" || (num(v) ?? 0) <= 100, "حداکثر ۱۰۰ درصد"),
    partnership_description: z.string().trim().max(2000),
    city_code: z.string().min(1, "شهر را انتخاب کنید"),
    district: z.string().trim().max(100),
    district_code: z
      .string()
      .trim()
      .max(8, "حداکثر ۸ کاراکتر")
      .regex(/^[A-Za-z0-9]*$/, "فقط حروف انگلیسی و عدد"),
    neighborhood: z.string().trim().max(100),
    exact_address: z.string().trim().max(500),
    postal_code: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[0-9۰-۹-]{5,12}$/.test(v), "کد پستی نامعتبر است"),
    has_parking: z.boolean(),
    has_elevator: z.boolean(),
    has_warehouse: z.boolean(),
    has_balcony: z.boolean(),
    amenities: z.record(z.string(), z.boolean()),
    description: z.string().max(4000),
    legal_info: z.string().trim().max(2000),
    owner_name: z.string().trim().max(200),
    owner_phone: z.string().trim().max(32),
  })
  .superRefine((v, ctx) => {
    const cfg = typeConfig(v.property_type);
    const areaField: AreaField = v.transaction_type === "partnership" ? "land_area" : cfg.requiredArea;
    if (v[areaField] === "") {
      ctx.addIssue({ code: "custom", path: [areaField], message: `${AREA_LABELS[areaField].replace(/ \(.+\)/, "")} الزامی است` });
    }
    if (v.transaction_type === "exchange" && v.exchange_description.length < 3) {
      ctx.addIssue({ code: "custom", path: ["exchange_description"], message: "بنویسید با چه چیزی معاوضه می‌شود" });
    }
    if (v.transaction_type === "partnership") {
      const total = (num(v.owner_share) ?? 0) + (num(v.builder_share) ?? 0);
      if (total > 100) ctx.addIssue({ code: "custom", path: ["builder_share"], message: "جمع سهم‌ها بیشتر از ۱۰۰ درصد است" });
    }
    if (v.registrant_type === "owner" && v.owner_name === "") {
      ctx.addIssue({ code: "custom", path: ["owner_name"], message: "وقتی ثبت‌کننده خود مالک است، نام مالک الزامی است" });
    }
  });

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  title: "",
  property_type: "apartment",
  transaction_type: "sale",
  status: "draft",
  registrant_type: "agent",
  land_area: "",
  built_area: "",
  useful_area: "",
  floor_area: "",
  rooms: "",
  bedrooms: "",
  bathrooms: "",
  floor_number: "",
  total_floors: "",
  year_built: "",
  price: "",
  deposit: "",
  rent_price: "",
  is_exchangeable: false,
  exchange_description: "",
  owner_share: "",
  builder_share: "",
  partnership_description: "",
  city_code: "ISF",
  district: "",
  district_code: "",
  neighborhood: "",
  exact_address: "",
  postal_code: "",
  has_parking: false,
  has_elevator: false,
  has_warehouse: false,
  has_balcony: false,
  amenities: {},
  description: "",
  legal_info: "",
  owner_name: "",
  owner_phone: "",
};

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function fromDetail(p: PropertyDetail): Values {
  const loc = p.location;
  return {
    ...EMPTY,
    title: p.title,
    property_type: p.property_type,
    transaction_type: p.transaction_type,
    status: p.status,
    registrant_type: (p.registrant_type as string) || "agent",
    land_area: str(p.land_area),
    built_area: str(p.built_area),
    useful_area: str(p.useful_area),
    floor_area: str(p.floor_area),
    rooms: str(p.rooms),
    bedrooms: str(p.bedrooms),
    bathrooms: str(p.bathrooms),
    floor_number: str(p.floor_number),
    total_floors: str(p.total_floors),
    year_built: str(p.year_built),
    price: str(p.price),
    deposit: str(p.deposit),
    rent_price: str(p.rent_price),
    is_exchangeable: !!p.is_exchangeable,
    exchange_description: p.exchange_description ?? "",
    owner_share: str(p.owner_share),
    builder_share: str(p.builder_share),
    partnership_description: p.partnership_description ?? "",
    city_code: loc?.city_code ?? "ISF",
    district: loc?.district ?? "",
    district_code: loc?.district_code ?? "",
    neighborhood: loc?.neighborhood ?? "",
    exact_address: loc?.exact_address ?? "",
    postal_code: loc?.postal_code ?? "",
    has_parking: !!p.has_parking,
    has_elevator: !!p.has_elevator,
    has_warehouse: !!p.has_warehouse,
    has_balcony: !!p.has_balcony,
    amenities: parseAmenities(p.amenities_json),
    description: p.description ?? "",
    legal_info: p.legal_info ?? "",
    owner_name: p.owner_name ?? "",
    owner_phone: p.owner_phone ?? "",
  };
}

function toPayload(v: Values, opts: { owner: boolean; address: boolean }): PropertyCreatePayload {
  const cfg = typeConfig(v.property_type);
  const t = v.transaction_type;
  const areas = new Set<AreaField>(t === "partnership" ? [...cfg.areas, "land_area"] : cfg.areas);
  const specs = new Set<SpecField>(cfg.specs);
  const area = (f: AreaField) => (areas.has(f) ? num(v[f]) : null);
  const spec = (f: SpecField) => (specs.has(f) ? num(v[f]) : null);
  const groups = new Set(cfg.groups);
  const amenities: Record<string, boolean> = {};
  AMENITIES.forEach((a) => {
    if (groups.has(a.group) && v.amenities[a.key]) amenities[a.key] = true;
  });
  const city = CITIES.find((c) => c.code === v.city_code);
  const exchangeable = t === "exchange" || (t === "sale" && v.is_exchangeable);

  const payload: PropertyCreatePayload = {
    title: v.title.trim(),
    description: v.description.trim() || null,
    property_type: v.property_type as PropertyType,
    transaction_type: t as TransactionType,
    status: v.status as PropertyStatus,
    registrant_type: v.registrant_type as RegistrantType,
    land_area: area("land_area"),
    built_area: area("built_area"),
    useful_area: area("useful_area"),
    floor_area: area("floor_area"),
    rooms: spec("rooms"),
    bedrooms: spec("bedrooms"),
    bathrooms: spec("bathrooms"),
    floor_number: spec("floor_number"),
    total_floors: spec("total_floors"),
    year_built: spec("year_built"),
    price: t === "sale" || t === "exchange" ? num(v.price) : null,
    deposit: t === "rent" ? num(v.deposit) : null,
    rent_price: t === "rent" ? num(v.rent_price) : null,
    is_exchangeable: exchangeable,
    exchange_description: exchangeable ? v.exchange_description || null : null,
    owner_share: t === "partnership" ? num(v.owner_share) : null,
    builder_share: t === "partnership" ? num(v.builder_share) : null,
    partnership_description: t === "partnership" ? v.partnership_description || null : null,
    has_parking: cfg.core.includes("has_parking") && v.has_parking,
    has_elevator: cfg.core.includes("has_elevator") && v.has_elevator,
    has_warehouse: cfg.core.includes("has_warehouse") && v.has_warehouse,
    has_balcony: cfg.core.includes("has_balcony") && v.has_balcony,
    amenities,
    location: {
      city: city?.name ?? null,
      city_code: v.city_code,
      district: v.district || null,
      district_code: v.district_code ? v.district_code.toUpperCase() : null,
      neighborhood: v.neighborhood || null,
    },
    usages: [{ usage_type: USAGE_BY_TYPE[v.property_type] ?? "residential", is_primary: true }],
  };
  // Fields the user is not allowed to read are left out entirely, so an edit
  // never wipes data they could not see.
  if (opts.address && payload.location) {
    payload.location.exact_address = v.exact_address || null;
    payload.location.postal_code = v.postal_code || null;
  }
  if (opts.owner) {
    payload.owner_name = v.owner_name || null;
    payload.owner_phone = v.owner_phone || null;
    payload.legal_info = v.legal_info || null;
  }
  return payload;
}

function SectionLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-border pt-4 first:border-t-0 first:pt-1">
      <p className="text-caption font-semibold text-primary">{children}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberField({
  name,
  label,
  register,
  errors,
  required,
  hint,
  placeholder = "اختیاری",
  allowNegative,
}: {
  name: keyof Values;
  label: string;
  register: UseFormRegister<Values>;
  errors: FieldErrors<Values>;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  allowNegative?: boolean;
}) {
  const error = errors[name]?.message as string | undefined;
  return (
    <Field label={label} error={error} required={required} hint={hint}>
      {(id, d) => (
        <Input
          id={id}
          aria-describedby={d}
          aria-invalid={!!error}
          inputMode={allowNegative ? "text" : "decimal"}
          className="tnum"
          placeholder={required ? undefined : placeholder}
          {...register(name)}
        />
      )}
    </Field>
  );
}

function MoneyField({
  name,
  label,
  control,
  register,
  errors,
  emptyHint = "خالی = توافقی",
}: {
  name: "price" | "deposit" | "rent_price";
  label: string;
  control: Control<Values>;
  register: UseFormRegister<Values>;
  errors: FieldErrors<Values>;
  emptyHint?: string;
}) {
  const value = useWatch({ control, name });
  const error = errors[name]?.message;
  return (
    <Field label={label} error={error} hint={value ? compactToman(parseNumber(value)) : emptyHint}>
      {(id, d) => (
        <Input id={id} aria-describedby={d} aria-invalid={!!error} inputMode="numeric" className="tnum" placeholder="مثلاً ۱۴۰۰۰۰۰۰۰۰۰" {...register(name)} />
      )}
    </Field>
  );
}

function AmenityChips({ control, groups }: { control: Control<Values>; groups: string[] }) {
  return (
    <Controller
      control={control}
      name="amenities"
      render={({ field }) => (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const items = AMENITIES.filter((a) => a.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="flex flex-col gap-2">
                <p className="text-caption text-muted-foreground">{AMENITY_GROUP_LABELS[g as keyof typeof AMENITY_GROUP_LABELS]}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((a) => {
                    const on = !!field.value[a.key];
                    return (
                      <button
                        key={a.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = { ...field.value };
                          if (on) delete next[a.key];
                          else next[a.key] = true;
                          field.onChange(next);
                        }}
                        className={cn(
                          "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-caption font-medium transition-colors duration-150",
                          on
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        {on ? <Check className="size-4" aria-hidden /> : <a.icon className="size-4" aria-hidden />}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    />
  );
}

/**
 * Create or edit a property. Fields adapt to the property type and the
 * transaction type. Create: online → POST with Idempotency-Key (then photos
 * are uploaded); offline → Outbox. Edit: PATCH with optimistic `version`.
 */
export function PropertyForm({ onDone, initial }: { onDone: (saved?: PropertyDetail) => void; initial?: PropertyDetail }) {
  const online = useOnline();
  const can = useCan();
  const editing = !!initial;
  // On create the owner/address fields are always writable; on edit only if readable.
  const allowOwner = !editing || can(PERM_OWNER);
  const allowAddress = !editing || can(PERM_ADDRESS);

  const defaults = useMemo(() => (initial ? fromDetail(initial) : EMPTY), [initial]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => reset(defaults), [defaults, reset]);

  const propertyType = useWatch({ control, name: "property_type" });
  const transaction = useWatch({ control, name: "transaction_type" });
  const isExchangeable = useWatch({ control, name: "is_exchangeable" });
  const district = useWatch({ control, name: "district" });
  const cityCode = useWatch({ control, name: "city_code" });
  const cfg = typeConfig(propertyType);
  const areas: AreaField[] = transaction === "partnership" && !cfg.areas.includes("land_area") ? ["land_area", ...cfg.areas] : cfg.areas;
  const requiredArea: AreaField = transaction === "partnership" ? "land_area" : cfg.requiredArea;

  // Auto-fill district code from known districts
  useEffect(() => {
    const known = DISTRICTS.find((d) => d.name.replace(/\s|‌/g, "") === district.replace(/\s|‌/g, ""));
    if (known) setValue("district_code", known.code);
  }, [district, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = toPayload(values, { owner: allowOwner, address: allowAddress });

    if (editing && initial) {
      try {
        const updated = await api.updateProperty(initial.id, { ...payload, version: initial.version });
        toast.success("تغییرات ملک ذخیره شد");
        invalidate("properties", "dashboard", "public");
        onDone(updated);
      } catch (err) {
        if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
          toast.warning("این ملک هم‌زمان توسط شخص دیگری تغییر کرده است؛ صفحه را تازه کنید و دوباره ویرایش کنید");
        } else toast.error(errorMessage(err, "ذخیره تغییرات ناموفق بود"));
      }
      return;
    }

    if (!online) {
      addToOutbox("create_property", payload);
      toast.info("آفلاین هستید — ملک در صف همگام‌سازی ذخیره شد", { icon: <CloudOff className="size-4" /> });
      onDone();
      return;
    }
    try {
      const created = await api.createProperty(payload, uid("prop"));
      if (photos.length) {
        setUploading({ done: 0, total: photos.length });
        const ok = await uploadLocalPhotos(created.id, photos, (done) => setUploading({ done, total: photos.length }));
        setUploading(null);
        if (ok < photos.length) toast.warning(`${faNum(photos.length - ok)} عکس آپلود نشد؛ از صفحه ملک دوباره تلاش کنید`);
      }
      toast.success(`ملک ثبت شد — کد ${created.code}`, {
        action: { label: "کپی لینک", onClick: () => void copyText(publicUrl(created.code), "لینک عمومی کپی شد") },
      });
      invalidate("properties", "dashboard", "public");
      onDone(created);
    } catch (err) {
      setUploading(null);
      toast.error(errorMessage(err, "خطا در ثبت ملک"));
    }
  });

  const districtOptions = DISTRICTS.filter((d) => d.city === cityCode);
  // Official inventory (approve/publish/sell…) is manager-only — docs/BUSINESS_RULES.md §3.
  const canApprove = can(PERM_PROPERTY_APPROVE);
  const currentStatus = initial?.status;
  const statusLocked = !canApprove && !!currentStatus && !["draft", "pending_review", "changes_requested"].includes(currentStatus);
  const statusOptions = canApprove
    ? editing
      ? PROPERTY_STATUSES
      : PROPERTY_STATUSES.filter((s) => ["draft", "pending_review", "published"].includes(s.value))
    : PROPERTY_STATUSES.filter((s) => SUBMISSION_STATUSES.includes(s.value) || s.value === currentStatus);
  const busy = isSubmitting || uploading !== null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <SectionLabel>اطلاعات پایه</SectionLabel>
      <Field label="عنوان آگهی" error={errors.title?.message} required>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} placeholder="مثلاً آپارتمان ۱۲۰ متری نوساز مرداویج" {...register("title")} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع ملک" error={errors.property_type?.message} hint="فیلدها بر اساس نوع ملک تغییر می‌کنند">
          {(id) => (
            <Controller
              control={control}
              name="property_type"
              render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={PROPERTY_TYPES} />}
            />
          )}
        </Field>
        <Field label="نوع معامله" error={errors.transaction_type?.message}>
          {(id) => (
            <Controller
              control={control}
              name="transaction_type"
              render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={TRANSACTION_TYPES} />}
            />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="وضعیت"
          hint={
            !canApprove
              ? statusLocked
                ? "وضعیت ملک تأییدشده را فقط مدیر تغییر می‌دهد"
                : "برای ورود به موجودی رسمی، «در انتظار بررسی» را انتخاب کنید تا مدیر تأیید کند"
              : editing
                ? undefined
                : "«منتشرشده» در ویترین عمومی دیده می‌شود"
          }
        >
          {(id) => (
            <Controller
              control={control}
              name="status"
              render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={statusOptions} disabled={statusLocked} />}
            />
          )}
        </Field>
        <Field label="ثبت‌کننده">
          {(id) => (
            <Controller
              control={control}
              name="registrant_type"
              render={({ field }) => <Select id={id} value={field.value} onValueChange={field.onChange} options={REGISTRANT_TYPES} />}
            />
          )}
        </Field>
      </div>

      {!editing && (
        <>
          <SectionLabel hint="اختیاری — حداکثر ۲۰ عکس">عکس‌ها</SectionLabel>
          <LocalPhotoPicker photos={photos} onChange={setPhotos} />
        </>
      )}

      <SectionLabel>{transaction === "rent" ? "اجاره" : transaction === "partnership" ? "مشارکت در ساخت" : transaction === "exchange" ? "معاوضه" : "قیمت"}</SectionLabel>
      {(transaction === "sale" || transaction === "exchange") && (
        <MoneyField name="price" label={PRICE_LABEL[transaction]} control={control} register={register} errors={errors} />
      )}
      {transaction === "rent" && (
        <div className="grid grid-cols-2 gap-3">
          <MoneyField name="deposit" label="ودیعه / رهن (تومان)" control={control} register={register} errors={errors} emptyHint="خالی = بدون ودیعه / توافقی" />
          <MoneyField name="rent_price" label="اجاره ماهانه (تومان)" control={control} register={register} errors={errors} emptyHint="خالی = رهن کامل / توافقی" />
        </div>
      )}
      {transaction === "sale" && (
        <Controller
          control={control}
          name="is_exchangeable"
          render={({ field }) => <SwitchRow label="قابل معاوضه" description="مالک معاوضه را هم می‌پذیرد" checked={field.value} onCheckedChange={field.onChange} />}
        />
      )}
      {(transaction === "exchange" || (transaction === "sale" && isExchangeable)) && (
        <Field label="معاوضه با" error={errors.exchange_description?.message} required={transaction === "exchange"}>
          {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.exchange_description} placeholder="مثلاً آپارتمان کوچک‌تر در تهران + مابه‌التفاوت" {...register("exchange_description")} />}
        </Field>
      )}
      {transaction === "partnership" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField name="owner_share" label="سهم مالک (٪)" register={register} errors={errors} placeholder="مثلاً ۵۰" />
            <NumberField name="builder_share" label="سهم سازنده (٪)" register={register} errors={errors} placeholder="مثلاً ۵۰" />
          </div>
          <Field label="شرایط مشارکت" error={errors.partnership_description?.message}>
            {(id, d) => <Textarea id={id} aria-describedby={d} placeholder="تعداد طبقات مجاز، پیش‌پرداخت، مدت ساخت…" {...register("partnership_description")} />}
          </Field>
        </>
      )}

      <SectionLabel>متراژ و مشخصات</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {areas.map((f) => (
          <NumberField key={f} name={f} label={AREA_LABELS[f]} register={register} errors={errors} required={f === requiredArea} />
        ))}
        {cfg.specs.map((f) => (
          <NumberField
            key={f}
            name={f}
            label={SPEC_LABELS[f]}
            register={register}
            errors={errors}
            allowNegative={f === "floor_number"}
            placeholder={f === "floor_number" ? "همکف = ۰، زیرزمین = ‎-۱" : f === "year_built" ? "مثلاً ۱۴۰۲" : "اختیاری"}
          />
        ))}
      </div>

      <SectionLabel>موقعیت</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="شهر" error={errors.city_code?.message}>
          {(id) => (
            <Controller
              control={control}
              name="city_code"
              render={({ field }) => (
                <Select id={id} value={field.value} onValueChange={field.onChange} options={CITIES.map((c) => ({ value: c.code, label: c.name }))} />
              )}
            />
          )}
        </Field>
        <Field label="منطقه / محله">
          {(id, d) => <Input id={id} aria-describedby={d} list="district-suggestions" placeholder="مثلاً مرداویج" {...register("district")} />}
        </Field>
        <datalist id="district-suggestions">
          {districtOptions.map((d) => (
            <option key={d.code} value={d.name} />
          ))}
        </datalist>
        <Field label="کد منطقه" hint="در کد ملک استفاده می‌شود" error={errors.district_code?.message}>
          {(id, d) => <Input id={id} ltr aria-describedby={d} placeholder="MJ" maxLength={8} {...register("district_code")} />}
        </Field>
        <Field label="محدوده / خیابان اصلی">
          {(id) => <Input id={id} placeholder="اختیاری" {...register("neighborhood")} />}
        </Field>
      </div>
      {allowAddress && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="آدرس دقیق (محرمانه)" className="col-span-2" hint="هرگز در صفحه عمومی نمایش داده نمی‌شود">
            {(id, d) => <Input id={id} aria-describedby={d} placeholder="اختیاری" {...register("exact_address")} />}
          </Field>
          <Field label="کد پستی" error={errors.postal_code?.message}>
            {(id, d) => <Input id={id} ltr aria-describedby={d} aria-invalid={!!errors.postal_code} inputMode="numeric" placeholder="اختیاری" {...register("postal_code")} />}
          </Field>
        </div>
      )}

      {(cfg.core.length > 0 || cfg.groups.length > 0) && <SectionLabel hint="روی هر مورد بزنید">امکانات</SectionLabel>}
      {cfg.core.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {CORE_FEATURES.filter((f) => cfg.core.includes(f.key)).map((f) => (
            <Controller
              key={f.key}
              control={control}
              name={f.key}
              render={({ field }) => <SwitchRow icon={<f.icon />} label={f.label} checked={field.value} onCheckedChange={field.onChange} />}
            />
          ))}
        </div>
      )}
      <AmenityChips control={control} groups={cfg.groups} />

      <SectionLabel>توضیحات</SectionLabel>
      <Field label="توضیحات آگهی" hint={editing ? undefined : "بعد از ثبت می‌توانید از «توضیح AI» برای نوشتن توضیح استفاده کنید"}>
        {(id, d) => <Textarea id={id} aria-describedby={d} placeholder="نورگیر، نوساز، دسترسی عالی…" {...register("description")} />}
      </Field>

      {allowOwner && (
        <>
          <SectionLabel hint="فقط برای اعضای مجاز دفتر">اطلاعات مالک و حقوقی (محرمانه)</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="نام مالک" error={errors.owner_name?.message}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.owner_name} placeholder="اختیاری" {...register("owner_name")} />}
            </Field>
            <Field label="موبایل مالک">
              {(id) => <Input id={id} ltr inputMode="tel" placeholder="0913…" {...register("owner_phone")} />}
            </Field>
          </div>
          <Field label="وضعیت سند و اطلاعات حقوقی">
            {(id) => <Textarea id={id} className="min-h-20" placeholder="مثلاً سند شش‌دانگ، بدون بدهی، پایان کار دارد" {...register("legal_info")} />}
          </Field>
        </>
      )}

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 mt-2 border-t border-border bg-popover px-5 pb-5 pt-3">
        <Button type="submit" size="lg" block loading={busy} variant={online || editing ? "primary" : "accent"} disabled={editing && !online}>
          {uploading
            ? `در حال آپلود عکس ${faNum(uploading.done)} از ${faNum(uploading.total)}…`
            : editing
              ? online
                ? "ذخیره تغییرات"
                : "برای ذخیره باید آنلاین باشید"
              : online
                ? "ثبت ملک و دریافت کد"
                : "ذخیره آفلاین در صف"}
        </Button>
      </div>
    </form>
  );
}
