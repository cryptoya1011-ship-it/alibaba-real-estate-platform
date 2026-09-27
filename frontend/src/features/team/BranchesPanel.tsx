import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building, MapPin, Pencil, Plus, Star } from "lucide-react";
import { api, ApiError } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useCan, useOrgSession } from "@/hooks/useSession";
import type { Branch } from "@/lib/types";
import { uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch, SwitchRow } from "@/components/ui/switch";
import { Code, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";

const schema = z.object({
  name: z.string().trim().min(2, "نام شعبه حداقل ۲ حرف").max(200),
  code: z
    .string()
    .trim()
    .min(1, "کد شعبه الزامی است")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "فقط حروف انگلیسی، عدد، - و _"),
  address: z.string().trim().max(500),
  is_main: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function BranchesPanel() {
  const { orgId } = useOrgSession();
  const can = useCan();
  const canManage = can("branch:manage");
  const branches = useApi(() => api.listBranches(), [orgId], { keys: ["branches"] });
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const toggleActive = async (b: Branch, isActive: boolean) => {
    setBusy(b.id);
    try {
      await api.updateBranch(b.id, { is_active: isActive, version: b.version });
      toast.success(isActive ? "شعبه فعال شد" : "شعبه غیرفعال شد");
      invalidate("branches", "members");
    } catch (err) {
      toast.error(errorMessage(err, "تغییر وضعیت ناموفق بود"));
      void branches.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> شعبه جدید
          </Button>
        </div>
      )}
      {branches.loading ? (
        <RowSkeleton count={3} />
      ) : branches.error ? (
        <ErrorState error={branches.error} onRetry={branches.reload} />
      ) : !branches.data?.length ? (
        <EmptyState
          icon={Building}
          title="هنوز شعبه‌ای ندارید"
          description="اگر دفتر شما چند شعبه دارد، آن‌ها را بسازید و اعضا را به هر شعبه اختصاص دهید."
          action={
            canManage ? (
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden /> شعبه جدید
              </Button>
            ) : undefined
          }
        />
      ) : (
        <StaggerList className="flex flex-col gap-2">
          {branches.data.map((b) => (
            <StaggerItem key={b.id} className="flex items-center gap-3 rounded-[14px] bg-card p-3 shadow-sm hairline">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Building className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                  {b.name}
                  <Code className="text-[11px]">{b.code}</Code>
                  {b.is_main && (
                    <Badge tone="accent">
                      <Star aria-hidden /> مرکزی
                    </Badge>
                  )}
                  {!b.is_active && <Badge tone="warning">غیرفعال</Badge>}
                </p>
                {b.address && (
                  <p className="flex items-center gap-1 truncate text-caption text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden /> {b.address}
                  </p>
                )}
              </div>
              {canManage && (
                <>
                  <Switch checked={b.is_active} onCheckedChange={(v) => void toggleActive(b, v)} disabled={busy === b.id} aria-label={`فعال بودن ${b.name}`} />
                  <Button variant="ghost" size="icon" onClick={() => setEditing(b)} aria-label={`ویرایش ${b.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                </>
              )}
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title={editing === "new" ? "شعبه جدید" : `ویرایش ${editing.name}`}>
            <BranchForm branch={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function BranchForm({ branch, onDone }: { branch: Branch | null; onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: branch?.name ?? "", code: branch?.code ?? "", address: branch?.address ?? "", is_main: branch?.is_main ?? false },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (branch) {
        await api.updateBranch(branch.id, { name: v.name, address: v.address || null, is_main: v.is_main, version: branch.version });
        toast.success("شعبه به‌روز شد");
      } else {
        await api.createBranch({ name: v.name, code: v.code.toUpperCase(), address: v.address || null, is_main: v.is_main }, uid("branch"));
        toast.success("شعبه ساخته شد");
      }
      invalidate("branches", "members");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") toast.warning("این شعبه هم‌زمان تغییر کرده؛ دوباره باز کنید");
      else toast.error(errorMessage(err, "ذخیره شعبه ناموفق بود"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <Field label="نام شعبه" error={errors.name?.message} required>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} placeholder="مثلاً شعبه مرداویج" {...register("name")} />}
      </Field>
      <Field label="کد شعبه" error={errors.code?.message} required hint={branch ? "کد شعبه بعد از ساخت قابل تغییر نیست" : "کوتاه و انگلیسی، مثلاً MJ1"}>
        {(id, d) => <Input id={id} ltr aria-describedby={d} aria-invalid={!!errors.code} disabled={!!branch} maxLength={32} {...register("code")} />}
      </Field>
      <Field label="آدرس" error={errors.address?.message}>
        {(id) => <Input id={id} placeholder="اختیاری" {...register("address")} />}
      </Field>
      <Controller
        control={control}
        name="is_main"
        render={({ field }) => <SwitchRow label="شعبه مرکزی" description="فقط یک شعبه می‌تواند مرکزی باشد" checked={field.value} onCheckedChange={field.onChange} />}
      />
      <Button type="submit" block loading={isSubmitting}>
        {branch ? "ذخیره تغییرات" : "ساخت شعبه"}
      </Button>
    </form>
  );
}
