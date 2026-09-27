import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/components/ui/states";

const schema = z.object({
  name: z.string().trim().min(2, "نام سازمان حداقل ۲ حرف باشد").max(200, "نام بیش از حد طولانی است"),
  slug: z
    .string()
    .trim()
    .min(3, "شناسه حداقل ۳ کاراکتر باشد")
    .max(64, "شناسه حداکثر ۶۴ کاراکتر")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "فقط حروف کوچک انگلیسی، عدد و خط تیره (مثل my-agency)"),
});
type Values = z.infer<typeof schema>;

export function CreateOrgForm({ onDone }: { onDone?: () => void }) {
  const { createOrganization } = useSession();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", slug: "" } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const s = await createOrganization(values.name, values.slug);
      const org = s.organizations.find((o) => o.id === s.organization_id);
      toast.success(`سازمان «${org?.name ?? values.name}» ساخته و فعال شد`);
      reset();
      onDone?.();
    } catch (err) {
      toast.error(errorMessage(err, "ساخت سازمان ناموفق بود"));
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <Field label="نام سازمان" error={errors.name?.message} required>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} placeholder="مثلاً املاک علی‌بابا" {...register("name")} />}
      </Field>
      <Field label="شناسه انگلیسی (slug)" hint="در آدرس‌ها استفاده می‌شود؛ بعداً قابل تغییر نیست" error={errors.slug?.message} required>
        {(id, d) => (
          <Input id={id} ltr aria-describedby={d} aria-invalid={!!errors.slug} placeholder="alibaba-isf" autoCapitalize="none" autoCorrect="off" {...register("slug")} />
        )}
      </Field>
      <Button type="submit" loading={isSubmitting} block>
        <Plus aria-hidden />
        ساخت سازمان
      </Button>
    </form>
  );
}
