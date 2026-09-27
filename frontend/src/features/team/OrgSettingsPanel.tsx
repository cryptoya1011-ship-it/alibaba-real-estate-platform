import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, ApiError } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useCan, useOrgSession } from "@/hooks/useSession";
import { CITIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Code, KeyValue } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorMessage } from "@/components/ui/states";

const NONE = "none";
const schema = z.object({
  name: z.string().trim().min(2, "نام سازمان حداقل ۲ حرف").max(200),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || /^[0-9۰-۹+\-\s]{5,32}$/.test(v), "شماره تلفن نامعتبر است"),
  city_code: z.string(),
});
type Values = z.infer<typeof schema>;

export function OrgSettingsPanel() {
  const { orgId, selectOrganization } = useOrgSession();
  const can = useCan();
  const canEdit = can("organization:update");
  const org = useApi(() => api.getOrganization(orgId), [orgId]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", phone: "", city_code: NONE } });

  useEffect(() => {
    if (org.data) reset({ name: org.data.name, phone: org.data.phone ?? "", city_code: org.data.city_code ?? NONE });
  }, [org.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    if (!org.data) return;
    try {
      const updated = await api.updateOrganization(orgId, {
        name: v.name,
        phone: v.phone || null,
        city_code: v.city_code === NONE ? null : v.city_code,
        version: org.data.version ?? 1,
      });
      org.setData(updated);
      // Re-issue the session so the header shows the new name.
      await selectOrganization(orgId).catch(() => undefined);
      toast.success("تنظیمات سازمان ذخیره شد");
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        toast.warning("تنظیمات هم‌زمان تغییر کرده بود؛ اطلاعات تازه شد");
        void org.reload();
      } else toast.error(errorMessage(err, "ذخیره تنظیمات ناموفق بود"));
    }
  });

  if (org.loading)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    );
  if (org.error || !org.data) return <ErrorState error={org.error} onRetry={org.reload} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5 rounded-[16px] bg-card p-4 hairline">
        <Field label="نام سازمان / دفتر" error={errors.name?.message} required>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} disabled={!canEdit} {...register("name")} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تلفن دفتر" error={errors.phone?.message}>
            {(id, d) => <Input id={id} ltr inputMode="tel" aria-describedby={d} aria-invalid={!!errors.phone} disabled={!canEdit} placeholder="031…" {...register("phone")} />}
          </Field>
          <Field label="شهر">
            {(id) => (
              <Controller
                control={control}
                name="city_code"
                render={({ field }) => (
                  <Select
                    id={id}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!canEdit}
                    options={[{ value: NONE, label: "انتخاب نشده" }, ...CITIES.map((c) => ({ value: c.code, label: c.name }))]}
                  />
                )}
              />
            )}
          </Field>
        </div>
        {canEdit ? (
          <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="self-start">
            ذخیره تنظیمات
          </Button>
        ) : (
          <p className="text-caption text-muted-foreground">برای ویرایش تنظیمات سازمان دسترسی ندارید.</p>
        )}
      </form>
      <div className="flex flex-col gap-2">
        <KeyValue label="شناسه (slug)" value={<Code>{org.data.slug}</Code>} />
        <KeyValue label="تاریخ ایجاد" value={formatDate(org.data.created_at)} />
        <KeyValue label="وضعیت" value={org.data.is_active === false ? "غیرفعال" : "فعال"} />
      </div>
    </div>
  );
}
