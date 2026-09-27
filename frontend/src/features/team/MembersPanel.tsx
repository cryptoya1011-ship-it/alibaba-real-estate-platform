import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building, Crown, MoreVertical, PauseCircle, PlayCircle, ShieldCheck, UserMinus, Users } from "lucide-react";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import { useCan, useOrgSession } from "@/hooks/useSession";
import type { Branch, Member, Role } from "@/lib/types";
import { roleLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/switch";
import { Avatar, Code, StaggerItem, StaggerList } from "@/components/ui/misc";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";

type EditTarget = { member: Member; kind: "roles" | "branches" } | null;

export function MembersPanel() {
  const { session, orgId } = useOrgSession();
  const can = useCan();
  const confirm = useConfirm();
  const members = useApi(() => api.listMembers(), [orgId], { keys: ["members"] });
  const roles = useApi(() => api.listRoles(orgId), [orgId], { keys: ["roles"], enabled: can("role:manage") });
  const branches = useApi(() => api.listBranches(), [orgId], { keys: ["branches"], enabled: can("branch:read") });
  const [edit, setEdit] = useState<EditTarget>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const canRoles = can("role:manage");
  const canBranches = can("branch:manage");
  const canStatus = can("organization:update");

  const run = async (m: Member, action: () => Promise<unknown>, success: string) => {
    setBusy(m.user_id);
    try {
      await action();
      toast.success(success);
      invalidate("members");
    } catch (err) {
      toast.error(errorMessage(err, "عملیات ناموفق بود"));
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (m: Member) => {
    if (m.is_active) {
      const yes = await confirm({
        title: `تعلیق ${m.display_name}؟`,
        description: "تا فعال‌سازی مجدد نمی‌تواند وارد این سازمان شود. نقش‌ها و شعب او حفظ می‌شود.",
        confirmLabel: "تعلیق",
        destructive: true,
      });
      if (!yes) return;
    }
    await run(m, () => api.setMemberActive(m.user_id, !m.is_active), m.is_active ? "عضو تعلیق شد" : "عضو دوباره فعال شد");
  };

  const remove = async (m: Member) => {
    const yes = await confirm({
      title: `حذف ${m.display_name} از سازمان؟`,
      description: "همه نقش‌ها و شعب این عضو حذف می‌شود. برای بازگشت باید دوباره دعوت شود. اطلاعات ثبت‌شده توسط او باقی می‌ماند.",
      confirmLabel: "حذف از سازمان",
      destructive: true,
    });
    if (yes) await run(m, () => api.removeMember(m.user_id), "عضو از سازمان حذف شد");
  };

  if (members.loading) return <RowSkeleton count={4} />;
  if (members.error) return <ErrorState error={members.error} onRetry={members.reload} />;
  if (!members.data?.length) return <EmptyState icon={Users} title="عضوی یافت نشد" />;

  return (
    <>
      <StaggerList className="flex flex-col gap-2">
        {members.data.map((m) => {
          const self = m.user_id === session.user.id;
          const locked = self || (m.is_owner && !session.user.is_super_admin);
          const hasActions = !locked && (canRoles || canBranches || canStatus);
          return (
            <StaggerItem key={m.user_id} className="flex items-start gap-3 rounded-[14px] bg-card p-3 shadow-sm hairline">
              <Avatar name={m.display_name} className={m.is_active ? "" : "opacity-50 grayscale"} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                  <span className="truncate">{m.display_name}</span>
                  {self && <Badge tone="info">شما</Badge>}
                  {m.is_owner && (
                    <Badge tone="accent">
                      <Crown aria-hidden /> مالک
                    </Badge>
                  )}
                  {!m.is_active && <Badge tone="warning">تعلیق‌شده</Badge>}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                  {m.telegram_username ? <Code>@{m.telegram_username}</Code> : m.telegram_id ? <Code>{String(m.telegram_id)}</Code> : null}
                  <span>عضو از {formatDate(m.joined_at)}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {m.roles.length ? (
                    m.roles.map((r) => (
                      <Badge key={r.id} tone={r.is_system ? "primary" : "outline"}>
                        <ShieldCheck aria-hidden /> {r.is_system ? roleLabel(r.code) : r.title}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="danger">بدون نقش</Badge>
                  )}
                  {m.branches.map((b) => (
                    <Badge key={b.id} tone={b.is_default ? "success" : "neutral"}>
                      <Building aria-hidden /> {b.name}
                    </Badge>
                  ))}
                </div>
              </div>
              {hasActions && (
                <DropdownMenu dir="rtl">
                  <DropdownTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`گزینه‌های ${m.display_name}`} loading={busy === m.user_id}>
                      {busy !== m.user_id && <MoreVertical aria-hidden />}
                    </Button>
                  </DropdownTrigger>
                  <DropdownContent>
                    {canRoles && (
                      <DropdownItem onSelect={() => setEdit({ member: m, kind: "roles" })}>
                        <ShieldCheck /> تغییر نقش‌ها
                      </DropdownItem>
                    )}
                    {canBranches && (
                      <DropdownItem onSelect={() => setEdit({ member: m, kind: "branches" })}>
                        <Building /> تعیین شعب
                      </DropdownItem>
                    )}
                    {canStatus && (
                      <>
                        <DropdownItem onSelect={() => void toggleActive(m)}>
                          {m.is_active ? <PauseCircle /> : <PlayCircle />} {m.is_active ? "تعلیق موقت" : "فعال‌سازی مجدد"}
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem destructive onSelect={() => void remove(m)}>
                          <UserMinus /> حذف از سازمان
                        </DropdownItem>
                      </>
                    )}
                  </DropdownContent>
                </DropdownMenu>
              )}
            </StaggerItem>
          );
        })}
      </StaggerList>
      <p className="mt-3 text-caption text-muted-foreground">
        بعد از تغییر نقش یا شعبه، عضو با باز کردن دوباره برنامه دسترسی‌های جدید را می‌گیرد. نقش‌ها و شعب خودتان و مالک سازمان قابل تغییر نیست.
      </p>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        {edit && (
          <DialogContent
            title={edit.kind === "roles" ? `نقش‌های ${edit.member.display_name}` : `شعب ${edit.member.display_name}`}
            description={edit.kind === "roles" ? "حداقل یک نقش انتخاب کنید" : "شعبه‌هایی که این عضو در آن‌ها فعالیت می‌کند"}
          >
            {edit.kind === "roles" ? (
              <RolesEditor
                member={edit.member}
                roles={roles.data ?? []}
                loading={roles.loading}
                onSave={(codes) => run(edit.member, () => api.setMemberRoles(edit.member.user_id, codes), "نقش‌ها به‌روز شد").then(() => setEdit(null))}
              />
            ) : (
              <BranchesEditor
                member={edit.member}
                branches={branches.data ?? []}
                loading={branches.loading}
                onSave={(ids, def) =>
                  run(edit.member, () => api.setMemberBranches(edit.member.user_id, ids, def), "شعب عضو به‌روز شد").then(() => setEdit(null))
                }
              />
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function RolesEditor({ member, roles, loading, onSave }: { member: Member; roles: Role[]; loading: boolean; onSave: (codes: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>(member.roles.map((r) => r.code));
  const [saving, setSaving] = useState(false);
  useEffect(() => setSelected(member.roles.map((r) => r.code)), [member]);
  if (loading) return <RowSkeleton count={3} />;
  const toggle = (code: string, on: boolean) => setSelected((s) => (on ? [...s, code] : s.filter((c) => c !== code)));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {roles.map((r) => {
          const id = `role-${r.id}`;
          return (
            <li key={r.id}>
              <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] bg-card-2 px-3.5 py-2 hairline">
                <Checkbox id={id} checked={selected.includes(r.code)} onCheckedChange={(v) => toggle(r.code, v)} />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{r.is_system ? roleLabel(r.code) : r.title}</span>
                  <span className="text-caption text-muted-foreground">{r.is_system ? "نقش سیستمی" : "نقش سفارشی"}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        block
        disabled={selected.length === 0}
        loading={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(selected);
          setSaving(false);
        }}
      >
        ذخیره نقش‌ها
      </Button>
    </div>
  );
}

function BranchesEditor({
  member,
  branches,
  loading,
  onSave,
}: {
  member: Member;
  branches: Branch[];
  loading: boolean;
  onSave: (ids: number[], defaultId: number | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>(member.branches.map((b) => b.id));
  const [def, setDef] = useState<number | null>(member.branches.find((b) => b.is_default)?.id ?? null);
  const [saving, setSaving] = useState(false);
  if (loading) return <RowSkeleton count={3} />;
  const active = branches.filter((b) => b.is_active || selected.includes(b.id));
  if (!active.length) return <EmptyState icon={Building} title="هنوز شعبه‌ای ساخته نشده" description="از بخش «شعب» اولین شعبه را بسازید." />;
  const toggle = (id: number, on: boolean) => {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
    if (!on && def === id) setDef(null);
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {active.map((b) => {
          const id = `branch-${b.id}`;
          const on = selected.includes(b.id);
          return (
            <li key={b.id} className="flex min-h-12 items-center gap-3 rounded-[12px] bg-card-2 px-3.5 py-2 hairline">
              <Checkbox id={id} checked={on} onCheckedChange={(v) => toggle(b.id, v)} />
              <label htmlFor={id} className="flex flex-1 cursor-pointer flex-col">
                <span className="font-medium">{b.name}</span>
                <Code className="text-[11px]">{b.code}</Code>
              </label>
              {on && (
                <Button size="sm" variant={def === b.id ? "soft" : "ghost"} onClick={() => setDef(b.id)} aria-pressed={def === b.id}>
                  {def === b.id ? "پیش‌فرض" : "انتخاب پیش‌فرض"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        block
        loading={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(selected, def && selected.includes(def) ? def : null);
          setSaving(false);
        }}
      >
        ذخیره شعب
      </Button>
    </div>
  );
}
