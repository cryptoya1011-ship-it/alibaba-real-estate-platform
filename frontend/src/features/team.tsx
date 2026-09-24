import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, KeyRound, Send, ShieldCheck, UserPlus, Users } from "lucide-react";
import { ApiError, api } from "../api";
import { faDateTime, faNum } from "../lib/format";
import type { InvitationItem, RoleItem } from "../lib/types";
import { useSession } from "../state/session";
import { Badge, Button, Card, Code, Confirm, CopyBtn, EmptyState, Field, Input, ListSkeleton, Modal, PageHead, Select } from "../components/ui";
import { toast } from "sonner";

const STATUS_FA: Record<string, string> = { pending: "در انتظار", accepted: "پذیرفته‌شده", revoked: "لغو شده", expired: "منقضی" };
const STATUS_TONE: Record<string, "warn" | "ok" | "danger" | "muted"> = { pending: "warn", accepted: "ok", revoked: "danger", expired: "muted" };

export default function TeamPage() {
  const { session } = useSession();
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [form, setForm] = useState({ telegram_id: "", role_code: "agent" });

  const orgId = session?.organization_id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [invs, rs] = await Promise.all([api.listInvitations(orgId), api.listRoles(orgId)]);
      setInvitations(invs as InvitationItem[]);
      setRoles(rs as RoleItem[]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در بارگیری تیم");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const createInvite = async () => {
    if (!orgId) return;
    if (!form.telegram_id.trim()) {
      toast.error("Telegram ID الزامی است");
      return;
    }
    setBusy(true);
    try {
      const created = (await api.createInvitation(orgId, {
        invited_telegram_id: Number(form.telegram_id),
        role_code: form.role_code,
      })) as InvitationItem;
      setCreatedToken(created.token ?? null);
      setForm({ telegram_id: "", role_code: "agent" });
      setOpen(false);
      await load();
      if (created.token) toast.success("دعوت‌نامه ساخته شد — توکن را کپی کنید");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ساخت دعوت‌نامه");
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async (token: string) => {
    try {
      await api.acceptInvitation(token);
      toast.success("دعوت پذیرفته شد — به دلیل تغییر permissions_version دوباره وارد شوید");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "توکن نامعتبر است");
    }
  };

  const pending = invitations.filter((i) => i.status === "pending").length;

  return (
    <div className="animate-fade-in">
      <PageHead
        title="تیم و دعوت‌ها"
        desc="Invitation Flow — توکن یک‌بار‌مصرف با ذخیره sha256"
        icon={<Users className="h-5 w-5" />}
        action={
          <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            دعوت عضو
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="brand">{faNum(invitations.length)} دعوت‌نامه</Badge>
        <Badge tone="warn">{faNum(pending)} در انتظار</Badge>
        <Badge tone="muted">{faNum(roles.length)} نقش موجود</Badge>
      </div>

      {loading && invitations.length === 0 ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-6 w-6" />}
              title="دعوت‌نامه‌ای وجود ندارد"
              desc="اعضای تیم را با Telegram ID دعوت کنید و نقش مناسب بدهید."
              action={
                <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
                  دعوت عضو
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li key={inv.id} className="animate-slide-up">
                  <Card className="flex flex-wrap items-center gap-3 p-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand dark:text-teal-200">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold">دعوت #{faNum(inv.id)}</span>
                        <span className="ltr tnum font-mono text-[10px] text-muted" dir="ltr">
                          {inv.invited_telegram_id ? `tg:${inv.invited_telegram_id}` : inv.invited_phone ?? "—"}
                        </span>
                        <Badge tone="brand">{inv.role_code}</Badge>
                        <Badge tone={STATUS_TONE[inv.status] ?? "muted"}>{STATUS_FA[inv.status] ?? inv.status}</Badge>
                      </div>
                      <div className="mt-1 text-[10px] text-muted">{faDateTime(inv.created_at)}</div>
                    </div>
                    {inv.status === "pending" && (
                      <Button variant="dangerSoft" size="xs" icon={<Ban className="h-3 w-3" />} onClick={() => setRevokeId(inv.id)}>
                        لغو
                      </Button>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {/* Accept invitation */}
          <Card className="p-4">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-bold">
              <KeyRound className="h-3.5 w-3.5 text-brand" />
              پذیرش دعوت با توکن
            </h3>
            <p className="mb-3 text-[10px] leading-5 text-muted">
              کاربر دعوت‌شده توکن را اینجا وارد می‌کند. پس از پذیرش، عضویت + نقش + شعبه ساخته و{" "}
              <Code>permissions_version</Code> افزایش می‌یابد؛ ورود مجدد لازم است.
            </p>
            <AcceptForm onSubmit={acceptInvite} />
          </Card>

          {/* Roles quick view */}
          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" />
              نقش‌های قابل انتخاب در دعوت
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="brand">agent — مشاور</Badge>
              <Badge tone="brand">branch_admin — مدیر شعبه</Badge>
              <Badge tone="brand">organization_admin — مدیر سازمان</Badge>
              {roles
                .filter((r) => !r.is_system)
                .map((r) => (
                  <Badge key={r.id} tone="gold">
                    {r.code} — {r.title} (سفارشی)
                  </Badge>
                ))}
            </div>
          </Card>
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        aria-label="دعوت عضو"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop transition active:scale-95 sm:hidden dark:text-slate-900"
      >
        <UserPlus className="h-6 w-6" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="دعوت عضو جدید به تیم">
        <div className="space-y-4">
          <Field label="Telegram ID" hint="کاربر باید در تلگرام شناخته شده باشد">
            <Input value={form.telegram_id} onChange={(e) => setForm({ ...form, telegram_id: e.target.value })} dir="ltr" className="font-mono" placeholder="123456789" />
          </Field>
          <Field label="نقش">
            <Select value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })}>
              <option value="agent">agent — مشاور</option>
              <option value="branch_admin">branch_admin — مدیر شعبه</option>
              <option value="organization_admin">organization_admin — مدیر سازمان</option>
              {roles
                .filter((r) => !r.is_system)
                .map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.code} — {r.title} (سفارشی)
                  </option>
                ))}
            </Select>
          </Field>
          <Button className="w-full" size="lg" loading={busy} icon={<Send className="h-4 w-4" />} onClick={createInvite}>
            ساخت دعوت‌نامه + توکن
          </Button>
        </div>
      </Modal>

      {/* One-time token modal */}
      <Modal open={!!createdToken} onClose={() => setCreatedToken(null)} title="توکن یک‌بارمصرف دعوت">
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[11px] leading-5 text-warn">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            این توکن فقط همین یک بار نمایش داده می‌شود. در سرور به‌صورت sha256 ذخیره شده است.
          </div>
          <div className="ltr break-all rounded-xl border border-line bg-raise p-3 text-center font-mono text-xs" dir="ltr">
            {createdToken}
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(createdToken ?? "");
                  toast.success("توکن کپی شد");
                } catch {
                  toast.error("کپی ناموفق بود");
                }
              }}
            >
              کپی توکن
            </Button>
            <Button variant="outline" onClick={() => setCreatedToken(null)}>
              بستن
            </Button>
          </div>
          <CopyBtn text={createdToken ?? ""} label="کپی سریع" />
        </div>
      </Modal>

      <Confirm
        open={revokeId !== null}
        onClose={() => setRevokeId(null)}
        title="لغو دعوت‌نامه"
        desc="با لغو، کاربر دیگر نمی‌تواند با این توکن دعوت را بپذیرد."
        confirmLabel="لغو دعوت‌نامه"
        onConfirm={async () => {
          if (!orgId || revokeId === null) return;
          try {
            await api.revokeInvitation(orgId, revokeId);
            toast.success("دعوت‌نامه لغو شد");
            await load();
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "خطا");
          }
        }}
      />
    </div>
  );
}

function AcceptForm({ onSubmit }: { onSubmit: (token: string) => Promise<void> }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="توکن دعوت را بچسبانید" className="font-mono text-xs" dir="ltr" />
      <Button
        loading={busy}
        onClick={async () => {
          if (!token.trim()) {
            toast.error("توکن را وارد کنید");
            return;
          }
          setBusy(true);
          await onSubmit(token.trim());
          setBusy(false);
          setToken("");
        }}
      >
        پذیرش
      </Button>
    </div>
  );
}
