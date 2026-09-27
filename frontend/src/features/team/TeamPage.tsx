import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building, KeyRound, MailPlus, Plus, RotateCw, Send, Settings2, ShieldAlert, Ticket, UserPlus, Users, XCircle } from "lucide-react";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useCan, useOrgSession } from "@/hooks/useSession";
import { useCreateParam } from "@/hooks/useCreateParam";
import type { Invitation } from "@/lib/types";
import { INVITATION_STATUS, roleLabel } from "@/lib/constants";
import { faNum, formatDateTime, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Code, CopyButton, PageHeader, SectionTitle, StaggerItem, StaggerList } from "@/components/ui/misc";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { Fab } from "@/components/ui/fab";
import { useConfirm } from "@/components/ui/confirm";
import { Segmented, TabPanel } from "@/components/ui/tabs";
import { MembersPanel } from "./MembersPanel";
import { BranchesPanel } from "./BranchesPanel";
import { OrgSettingsPanel } from "./OrgSettingsPanel";

type TeamTab = "members" | "invites" | "branches" | "settings";

export default function TeamPage() {
  const { orgId, currentOrg } = useOrgSession();
  const [createOpen, setCreateOpen] = useCreateParam();
  const [token, setToken] = useState<string | null>(null);
  const invites = useApi(() => api.listInvitations(orgId), [orgId], { keys: ["invitations"] });
  const roles = useApi(() => api.listRoles(orgId), [orgId], { keys: ["roles"] });
  const confirm = useConfirm();
  const [revoking, setRevoking] = useState<number | null>(null);

  const can = useCan();
  const [params, setParams] = useSearchParams();
  const tabs: { value: TeamTab; label: string; icon: JSX.Element; show: boolean }[] = [
    { value: "members", label: "اعضا", icon: <Users aria-hidden />, show: can("organization:member:read") },
    { value: "invites", label: "دعوت‌نامه‌ها", icon: <MailPlus aria-hidden />, show: true },
    { value: "branches", label: "شعب", icon: <Building aria-hidden />, show: can("branch:read") },
    { value: "settings", label: "تنظیمات", icon: <Settings2 aria-hidden />, show: can("organization:read") },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const requested = params.get("tab") as TeamTab | null;
  const tab: TeamTab = visibleTabs.some((t) => t.value === requested) ? (requested as TeamTab) : (visibleTabs[0]?.value ?? "invites");
  const setTab = (t: TeamTab) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  // System roles are stored with their code as title — always show the Persian label for them.
  const roleTitle = (code: string) => {
    const role = roles.data?.find((r) => r.code === code);
    return role && !role.is_system ? role.title : roleLabel(code);
  };

  const revoke = async (inv: Invitation) => {
    const ok = await confirm({
      title: "لغو دعوت‌نامه؟",
      description: "توکن این دعوت دیگر قابل استفاده نخواهد بود.",
      confirmLabel: "لغو دعوت",
      destructive: true,
    });
    if (!ok) return;
    setRevoking(inv.id);
    try {
      await api.revokeInvitation(orgId, inv.id);
      toast.success("دعوت‌نامه لغو شد");
      invalidate("invitations");
    } catch (err) {
      toast.error(errorMessage(err, "لغو دعوت ناموفق بود"));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={UserPlus}
        title="تیم و سازمان"
        description={currentOrg ? `اعضا، دعوت‌نامه‌ها، شعب و تنظیمات «${currentOrg.name}»` : "مدیریت تیم"}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={invites.reload} aria-label="بارگذاری مجدد" disabled={invites.refreshing}>
              <RotateCw className={invites.refreshing ? "animate-spin" : ""} aria-hidden />
            </Button>
            <Button className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> دعوت عضو
            </Button>
          </>
        }
      />

      <Segmented aria-label="بخش‌های تیم" items={visibleTabs.map(({ value, label, icon }) => ({ value, label, icon }))} value={tab} onChange={setTab} />

      <TabPanel when={tab} value="members">
        <MembersPanel />
      </TabPanel>
      <TabPanel when={tab} value="branches">
        <BranchesPanel />
      </TabPanel>
      <TabPanel when={tab} value="settings">
        <OrgSettingsPanel />
      </TabPanel>

      <TabPanel when={tab} value="invites">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-3" aria-labelledby="invites-title">
          <SectionTitle>
            <span id="invites-title">دعوت‌نامه‌ها</span>
          </SectionTitle>
          {invites.loading ? (
            <RowSkeleton count={4} />
          ) : invites.error ? (
            <ErrorState error={invites.error} onRetry={invites.reload} />
          ) : !invites.data || invites.data.length === 0 ? (
            <EmptyState
              icon={MailPlus}
              title="هنوز دعوتی ارسال نشده"
              description="برای همکاران دعوت‌نامه بسازید؛ توکن یک‌بار مصرف را برایشان بفرستید."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden /> دعوت عضو
                </Button>
              }
            />
          ) : (
            <StaggerList className="flex flex-col gap-2">
              {invites.data.map((inv) => {
                const st = INVITATION_STATUS[inv.status] ?? { label: inv.status, tone: "neutral" as const };
                return (
                  <StaggerItem key={inv.id} className="flex items-center gap-3 rounded-[14px] bg-card p-3 shadow-sm hairline">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      {inv.invited_telegram_id ? <Send className="size-[18px]" aria-hidden /> : <Ticket className="size-[18px]" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                        {inv.invited_telegram_id ? (
                          <>
                            تلگرام <Code>{String(inv.invited_telegram_id)}</Code>
                          </>
                        ) : inv.invited_phone ? (
                          <Code>{inv.invited_phone}</Code>
                        ) : (
                          `دعوت #${faNum(inv.id)}`
                        )}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {roleTitle(inv.role_code)} · {relativeTime(inv.created_at)}
                        {inv.status === "pending" && inv.expires_at && <> · اعتبار تا {formatDateTime(inv.expires_at)}</>}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {inv.status === "pending" && (
                      <Button variant="ghost" size="icon-sm" aria-label="لغو دعوت" onClick={() => revoke(inv)} loading={revoking === inv.id} className="text-danger">
                        <XCircle aria-hidden />
                      </Button>
                    )}
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </section>

        <AcceptCard />
      </div>
      </TabPanel>

      {tab === "invites" && <Fab label="دعوت عضو" onClick={() => setCreateOpen(true)} />}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="دعوت عضو جدید" description="یک توکن یک‌بار مصرف ساخته می‌شود">
          <InviteForm
            orgId={orgId}
            roleOptions={(roles.data ?? []).map((r) => ({ value: r.code, label: r.is_system ? roleLabel(r.code) : r.title || r.code, hint: r.is_system ? "سیستمی" : "سفارشی" }))}
            onCreated={(t) => {
              setCreateOpen(false);
              setToken(t);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={token !== null} onOpenChange={(o) => !o && setToken(null)}>
        {token && (
          <DialogContent
            title="توکن دعوت ساخته شد"
            description="این توکن فقط همین یک بار نمایش داده می‌شود؛ همین حالا کپی و ارسال کنید."
            footer={
              <Button block onClick={() => setToken(null)}>
                متوجه شدم
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-[12px] bg-warning-soft p-3 text-caption text-warning">
                <ShieldAlert className="size-4 shrink-0" aria-hidden />
                پس از بستن این پنجره، امکان مشاهده دوباره توکن وجود ندارد.
              </div>
              <div className="flex items-center gap-2 rounded-[12px] bg-card-2 p-3 hairline">
                <code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-caption">
                  {token}
                </code>
                <CopyButton text={token} label="کپی" size="sm" success="توکن کپی شد" />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

const inviteSchema = z.object({
  telegram_id: z
    .string()
    .trim()
    .regex(/^[0-9۰-۹]{3,15}$/, "شناسه عددی تلگرام را وارد کنید"),
  role_code: z.string().min(1, "نقش را انتخاب کنید"),
  expires_in_days: z.string(),
});
type InviteValues = z.infer<typeof inviteSchema>;

const INVITE_EXPIRY_OPTIONS = [1, 3, 7, 14, 30].map((d) => ({ value: String(d), label: `${faNum(d)} روز` }));

function InviteForm({ orgId, roleOptions, onCreated }: { orgId: number; roleOptions: { value: string; label: string; hint?: string }[]; onCreated: (token: string) => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { telegram_id: "", role_code: "agent", expires_in_days: "7" } });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const id = Number(v.telegram_id.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
      const inv = await api.createInvitation(orgId, { invited_telegram_id: id, role_code: v.role_code, expires_in_days: Number(v.expires_in_days) });
      toast.success("دعوت‌نامه ساخته شد");
      invalidate("invitations");
      onCreated(inv.token ?? "");
    } catch (err) {
      toast.error(errorMessage(err, "ساخت دعوت ناموفق بود"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <Field label="شناسه تلگرام" error={errors.telegram_id?.message} hint="شناسه عددی کاربر در تلگرام" required>
        {(id, d) => <Input id={id} ltr inputMode="numeric" placeholder="1000002" aria-describedby={d} aria-invalid={!!errors.telegram_id} {...register("telegram_id")} />}
      </Field>
      <Field label="نقش" error={errors.role_code?.message}>
        {(id) => (
          <Controller
            control={control}
            name="role_code"
            render={({ field }) => (
              <Select
                id={id}
                value={field.value}
                onValueChange={field.onChange}
                options={roleOptions.length ? roleOptions : [{ value: "agent", label: roleLabel("agent") }]}
              />
            )}
          />
        )}
      </Field>
      <Field label="اعتبار دعوت‌نامه" hint="بعد از این مدت یا پس از یک بار استفاده، دعوت‌نامه باطل می‌شود">
        {(id) => (
          <Controller
            control={control}
            name="expires_in_days"
            render={({ field }) => (
              <Select id={id} value={field.value} onValueChange={field.onChange} options={INVITE_EXPIRY_OPTIONS} />
            )}
          />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting}>
        <MailPlus aria-hidden /> ساخت دعوت‌نامه
      </Button>
    </form>
  );
}

const acceptSchema = z.object({ token: z.string().trim().min(8, "توکن معتبر نیست") });

function AcceptCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ token: string }>({ resolver: zodResolver(acceptSchema), defaultValues: { token: "" } });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.acceptInvitation(v.token);
      toast.success("دعوت پذیرفته شد؛ سازمان جدید در فهرست سازمان‌ها است");
      reset();
      invalidate("invitations", "organizations");
    } catch (err) {
      toast.error(errorMessage(err, "پذیرش دعوت ناموفق بود"));
    }
  });
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-[18px] text-accent" aria-hidden /> پذیرش دعوت
        </CardTitle>
        <CardDescription>توکنی که از مدیر سازمان گرفته‌اید را وارد کنید.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <Field label="توکن دعوت" error={errors.token?.message}>
            {(id, d) => <Input id={id} ltr className="font-mono" autoComplete="off" aria-describedby={d} aria-invalid={!!errors.token} {...register("token")} />}
          </Field>
          <Button type="submit" variant="accent" block loading={isSubmitting}>
            پذیرش دعوت
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
