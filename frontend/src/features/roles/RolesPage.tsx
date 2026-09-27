import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronDown, Lock, Plus, RotateCw, ShieldCheck, ShieldPlus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useOrgSession } from "@/hooks/useSession";
import { useCreateParam } from "@/hooks/useCreateParam";
import type { Role } from "@/lib/types";
import { PERMISSION_GROUPS, PERMISSION_LABELS, roleLabel } from "@/lib/constants";
import { faNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/switch";
import { Code, PageHeader, SectionTitle, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { Fab } from "@/components/ui/fab";
import { useConfirm } from "@/components/ui/confirm";

const TOTAL_PERMS = PERMISSION_GROUPS.reduce((n, g) => n + g.items.length, 0);

export default function RolesPage() {
  const { orgId } = useOrgSession();
  const [createOpen, setCreateOpen] = useCreateParam();
  const { data, error, loading, reload, refreshing } = useApi(() => api.listRoles(orgId), [orgId], { keys: ["roles"] });
  const system = (data ?? []).filter((r) => r.is_system);
  const custom = (data ?? []).filter((r) => !r.is_system);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={ShieldCheck}
        title="نقش‌ها و دسترسی"
        description="نقش‌های سیستمی و نقش‌های سفارشی سازمان"
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={reload} aria-label="بارگذاری مجدد" disabled={refreshing}>
              <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> نقش سفارشی
            </Button>
          </>
        }
      />

      {loading ? (
        <RowSkeleton count={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <SectionTitle>نقش‌های سیستمی</SectionTitle>
            <StaggerList className="flex flex-col gap-2">
              {system.map((r) => (
                <StaggerItem key={r.id}>
                  <RoleCard role={r} orgId={orgId} />
                </StaggerItem>
              ))}
            </StaggerList>
          </section>
          <section className="flex flex-col gap-3">
            <SectionTitle>نقش‌های سفارشی</SectionTitle>
            {custom.length === 0 ? (
              <EmptyState
                icon={ShieldPlus}
                title="نقش سفارشی ندارید"
                description="برای نیازهای خاص (مثلاً مدیر فروش) نقش با دسترسی دلخواه بسازید."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden /> نقش سفارشی
                  </Button>
                }
              />
            ) : (
              <StaggerList className="flex flex-col gap-2">
                {custom.map((r) => (
                  <StaggerItem key={r.id}>
                    <RoleCard role={r} orgId={orgId} />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </section>
        </div>
      )}

      <Fab label="نقش سفارشی" onClick={() => setCreateOpen(true)} />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="نقش سفارشی جدید" description="کد، عنوان و دسترسی‌ها را مشخص کنید" size="lg">
          <RoleForm orgId={orgId} onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleCard({ role, orgId }: { role: Role; orgId: number }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();
  const perms = new Set(role.permissions);

  const remove = async () => {
    const ok = await confirm({
      title: `حذف نقش «${role.title}»؟`,
      description: "اعضایی که این نقش را دارند دسترسی‌های مربوطه را از دست می‌دهند.",
      confirmLabel: "حذف نقش",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.deleteRole(orgId, role.id);
      toast.success("نقش حذف شد");
      invalidate("roles");
    } catch (err) {
      toast.error(errorMessage(err, "حذف نقش ناموفق بود"));
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-[16px] bg-card shadow-sm hairline">
      <div className="flex items-center gap-3 p-3.5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px]", role.is_system ? "bg-muted text-muted-foreground" : "bg-accent-soft text-accent")}>
          {role.is_system ? <Lock className="size-[18px]" aria-hidden /> : <ShieldPlus className="size-[18px]" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{role.title || roleLabel(role.code)}</p>
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            <Code>{role.code}</Code>
            <span className="tnum">
              {faNum(role.permissions.length)} از {faNum(TOTAL_PERMS)} دسترسی
            </span>
          </div>
        </div>
        {role.is_system ? (
          <Badge tone="neutral">سیستمی</Badge>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={`حذف نقش ${role.title}`} className="text-danger" onClick={remove} loading={deleting}>
            <Trash2 aria-hidden />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={open ? "بستن دسترسی‌ها" : "نمایش دسترسی‌ها"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-border p-3.5">
              {PERMISSION_GROUPS.map((g) => {
                const has = g.items.filter((i) => perms.has(i.code));
                if (has.length === 0) return null;
                return (
                  <div key={g.key}>
                    <p className="mb-1.5 text-caption font-semibold text-muted-foreground">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {has.map((i) => (
                        <Badge key={i.code} tone="primary">
                          {i.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {role.permissions.filter((p) => !PERMISSION_LABELS[p]).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions
                    .filter((p) => !PERMISSION_LABELS[p])
                    .map((p) => (
                      <Code key={p}>{p}</Code>
                    ))}
                </div>
              )}
              {role.permissions.length === 0 && <p className="text-caption text-muted-foreground">بدون دسترسی</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,49}$/, "فقط حروف کوچک انگلیسی، عدد و _ (حداقل ۳ حرف)"),
  title: z.string().trim().min(2, "عنوان الزامی است").max(100),
  permission_codes: z.array(z.string()).min(1, "حداقل یک دسترسی انتخاب کنید"),
});
type Values = z.infer<typeof schema>;

function RoleForm({ orgId, onDone }: { orgId: number; onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: "", title: "", permission_codes: [] } });
  const selected = useWatch({ control, name: "permission_codes" });
  const set = new Set(selected);

  const toggleGroup = (codes: string[], on: boolean) => {
    const next = new Set(selected);
    codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
    setValue("permission_codes", [...next], { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.createRole(orgId, v);
      toast.success(`نقش «${v.title}» ساخته شد`);
      invalidate("roles");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "ساخت نقش ناموفق بود"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="کد نقش" error={errors.code?.message} hint="مثلاً sales_manager" required>
          {(id, d) => <Input id={id} ltr className="font-mono" autoComplete="off" aria-describedby={d} aria-invalid={!!errors.code} {...register("code")} />}
        </Field>
        <Field label="عنوان" error={errors.title?.message} required>
          {(id, d) => <Input id={id} placeholder="مدیر فروش" aria-describedby={d} aria-invalid={!!errors.title} {...register("title")} />}
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <p className="font-semibold">دسترسی‌ها</p>
        <span className="tnum text-caption text-muted-foreground">
          {faNum(selected.length)} انتخاب‌شده
        </span>
      </div>
      {errors.permission_codes && (
        <p role="alert" className="-mt-2 text-caption text-danger">
          {errors.permission_codes.message}
        </p>
      )}
      <Controller
        control={control}
        name="permission_codes"
        render={() => (
          <div className="grid gap-3 sm:grid-cols-2">
            {PERMISSION_GROUPS.map((g) => {
              const codes = g.items.map((i) => i.code);
              const count = codes.filter((c) => set.has(c)).length;
              const state = count === 0 ? false : count === codes.length ? true : "indeterminate";
              return (
                <fieldset key={g.key} className="rounded-[14px] bg-card-2 p-3 hairline">
                  <legend className="sr-only">{g.label}</legend>
                  <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-border pb-2 font-semibold">
                    <Checkbox checked={state} onCheckedChange={(v) => toggleGroup(codes, v)} />
                    {g.label}
                    <span className="tnum ms-auto text-caption font-normal text-muted-foreground">
                      {faNum(count)}/{faNum(codes.length)}
                    </span>
                  </label>
                  <div className="flex flex-col">
                    {g.items.map((i) => (
                      <label key={i.code} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-body">
                        <Checkbox checked={set.has(i.code)} onCheckedChange={(v) => toggleGroup([i.code], v)} />
                        <span className="flex-1">{i.label}</span>
                        <span dir="ltr" className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                          {i.code}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
      />
      <Button type="submit" size="lg" block loading={isSubmitting}>
        ساخت نقش
      </Button>
    </form>
  );
}
