import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowUpFromLine, Car, CloudOff, Package, Sun } from "lucide-react";
import { api, addToOutbox } from "@/api";
import { invalidate } from "@/hooks/useApi";
import { useOnline } from "@/hooks/useOnline";
import type { PropertyCreatePayload, PropertyStatus, PropertyType, TransactionType } from "@/lib/types";
import { CITIES, DISTRICTS, PROPERTY_TYPES, TRANSACTION_TYPES } from "@/lib/constants";
import { compactToman, parseNumber, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch";
import { copyText } from "@/components/ui/misc";
import { errorMessage } from "@/components/ui/states";
import { publicUrl } from "./PropertyCard";

const numeric = (msg = "فقط عدد وارد کنید") =>
  z.string().trim().refine((v) => v === "" || (parseNumber(v) !== null && (parseNumber(v) ?? -1) >= 0), msg);

const schema = z.object({
  title: z.string().trim().min(3, "عنوان حداقل ۳ حرف باشد").max(300, "عنوان طولانی است"),
  property_type: z.string().min(1, "نوع ملک را انتخاب کنید"),
  transaction_type: z.string().min(1, "نوع معامله را انتخاب کنید"),
  status: z.enum(["draft", "published"]),
  built_area: numeric().refine((v) => v !== "", "متراژ الزامی است"),
  price: numeric(),
  rooms: numeric(),
  city_code: z.string().min(1, "شهر را انتخاب کنید"),
  district: z.string().trim().max(100),
  district_code: z
    .string()
    .trim()
    .max(8, "حداکثر ۸ کاراکتر")
    .regex(/^[A-Za-z0-9]*$/, "فقط حروف انگلیسی و عدد"),
  has_parking: z.boolean(),
  has_elevator: z.boolean(),
  has_warehouse: z.boolean(),
  has_balcony: z.boolean(),
  description: z.string().max(4000),
  owner_name: z.string().trim().max(200),
  owner_phone: z.string().trim().max(32),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = {
  title: "",
  property_type: "apartment",
  transaction_type: "sale",
  status: "draft",
  built_area: "100",
  price: "",
  rooms: "",
  city_code: "ISF",
  district: "مرداویج",
  district_code: "MJ",
  has_parking: true,
  has_elevator: true,
  has_warehouse: false,
  has_balcony: false,
  description: "",
  owner_name: "",
  owner_phone: "",
};

const USAGE_BY_TYPE: Record<string, string> = {
  commercial: "commercial",
  office: "office",
  administrative: "administrative",
  industrial: "industrial",
  garden: "garden",
};

function toPayload(v: Values): PropertyCreatePayload {
  const city = CITIES.find((c) => c.code === v.city_code);
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    property_type: v.property_type as PropertyType,
    transaction_type: v.transaction_type as TransactionType,
    status: v.status as PropertyStatus,
    built_area: parseNumber(v.built_area),
    price: parseNumber(v.price),
    rooms: parseNumber(v.rooms),
    has_parking: v.has_parking,
    has_elevator: v.has_elevator,
    has_warehouse: v.has_warehouse,
    has_balcony: v.has_balcony,
    owner_name: v.owner_name || null,
    owner_phone: v.owner_phone || null,
    location: {
      city: city?.name ?? null,
      city_code: v.city_code,
      district: v.district || null,
      district_code: v.district_code ? v.district_code.toUpperCase() : null,
    },
    usages: [{ usage_type: USAGE_BY_TYPE[v.property_type] ?? "residential", is_primary: true }],
  };
}

function SectionLabel({ children }: { children: string }) {
  return <p className="pt-2 text-caption font-semibold text-primary">{children}</p>;
}

/** Create-property form. Online → POST with Idempotency-Key; offline → Outbox. */
export function PropertyForm({ onDone }: { onDone: () => void }) {
  const online = useOnline();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const price = useWatch({ control, name: "price" });
  const district = useWatch({ control, name: "district" });
  const cityCode = useWatch({ control, name: "city_code" });

  // Auto-fill district code from known districts
  useEffect(() => {
    const known = DISTRICTS.find((d) => d.name.replace(/\s|‌/g, "") === district.replace(/\s|‌/g, ""));
    if (known) setValue("district_code", known.code);
  }, [district, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = toPayload(values);
    if (!online) {
      addToOutbox("create_property", payload);
      toast.info("آفلاین هستید — ملک در صف همگام‌سازی ذخیره شد", { icon: <CloudOff className="size-4" /> });
      onDone();
      return;
    }
    try {
      const created = await api.createProperty(payload, uid("prop"));
      toast.success(`ملک ثبت شد — کد ${created.code}`, {
        action: { label: "کپی لینک", onClick: () => void copyText(publicUrl(created.code), "لینک عمومی کپی شد") },
      });
      invalidate("properties", "dashboard", "public");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "خطا در ثبت ملک"));
    }
  });

  const districtOptions = DISTRICTS.filter((d) => d.city === cityCode);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <SectionLabel>اطلاعات پایه</SectionLabel>
      <Field label="عنوان آگهی" error={errors.title?.message} required>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} placeholder="مثلاً آپارتمان ۱۲۰ متری نوساز مرداویج" {...register("title")} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع ملک" error={errors.property_type?.message}>
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
      <Field label="وضعیت انتشار" hint="منتشرشده‌ها در ویترین عمومی و لینک /p/ نمایش داده می‌شوند">
        {(id) => (
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                id={id}
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  { value: "draft", label: "پیش‌نویس (داخلی)" },
                  { value: "published", label: "منتشرشده (عمومی)" },
                ]}
              />
            )}
          />
        )}
      </Field>

      <SectionLabel>مشخصات و قیمت</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="متراژ (متر مربع)" error={errors.built_area?.message} required>
          {(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" className="tnum" aria-invalid={!!errors.built_area} {...register("built_area")} />}
        </Field>
        <Field label="تعداد اتاق" error={errors.rooms?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" className="tnum" placeholder="اختیاری" {...register("rooms")} />}
        </Field>
      </div>
      <Field label="قیمت (تومان)" error={errors.price?.message} hint={price ? compactToman(parseNumber(price)) : "خالی = توافقی"}>
        {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" className="tnum" placeholder="مثلاً ۱۴۰۰۰۰۰۰۰۰۰" aria-invalid={!!errors.price} {...register("price")} />}
      </Field>

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
        <Field label="محله">
          {(id, d) => <Input id={id} aria-describedby={d} list="district-suggestions" placeholder="مثلاً مرداویج" {...register("district")} />}
        </Field>
        <datalist id="district-suggestions">
          {districtOptions.map((d) => (
            <option key={d.code} value={d.name} />
          ))}
        </datalist>
      </div>
      <Field label="کد محله" hint="برای ساخت کد ملک؛ محله‌های شناخته‌شده خودکار پر می‌شوند" error={errors.district_code?.message}>
        {(id, d) => <Input id={id} ltr aria-describedby={d} placeholder="MJ" maxLength={8} {...register("district_code")} />}
      </Field>

      <SectionLabel>امکانات</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        <Controller control={control} name="has_parking" render={({ field }) => <SwitchRow icon={<Car />} label="پارکینگ" checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller control={control} name="has_elevator" render={({ field }) => <SwitchRow icon={<ArrowUpFromLine />} label="آسانسور" checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller control={control} name="has_warehouse" render={({ field }) => <SwitchRow icon={<Package />} label="انباری" checked={field.value} onCheckedChange={field.onChange} />} />
        <Controller control={control} name="has_balcony" render={({ field }) => <SwitchRow icon={<Sun />} label="بالکن" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      <Field label="توضیحات" hint="بعد از ثبت می‌توانید از «پیشنهاد AI» برای نوشتن توضیح استفاده کنید">
        {(id, d) => <Textarea id={id} aria-describedby={d} placeholder="نورگیر، نوساز، دسترسی عالی…" {...register("description")} />}
      </Field>

      <SectionLabel>اطلاعات مالک (محرمانه)</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="نام مالک">
          {(id) => <Input id={id} placeholder="اختیاری" {...register("owner_name")} />}
        </Field>
        <Field label="موبایل مالک">
          {(id) => <Input id={id} ltr inputMode="tel" placeholder="0913…" {...register("owner_phone")} />}
        </Field>
      </div>

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 mt-2 border-t border-border bg-popover px-5 pb-5 pt-3">
        <Button type="submit" size="lg" block loading={isSubmitting} variant={online ? "primary" : "accent"}>
          {online ? "ثبت ملک و دریافت کد" : "ذخیره آفلاین در صف"}
        </Button>
      </div>
    </form>
  );
}
