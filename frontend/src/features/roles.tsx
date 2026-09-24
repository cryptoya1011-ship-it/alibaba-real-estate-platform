import { useCallback, useEffect, useState } from "react";
import { Check, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ApiError, api } from "../api";
import { cn } from "../lib/cn";
import { faNum } from "../lib/format";
import type { RoleItem } from "../lib/types";
import { useSession } from "../state/session";
import { Badge, Button, Card, Code, Confirm, EmptyState, Field, Input, ListSkeleton, Modal, PageHead } from "../components/ui";
import { toast } from "sonner";

const PERMISSION_GROUPS: { group: string; items: { code: string; label: string }[] }[] = [
  {
    group: "املاک",
    items: [
      { code: "property:read", label: "مشاهده املاک" },
      { code: "property:create", label: "ثبت ملک" },
      { code: "property:update", label: "ویرایش ملک" },
      { code: "property:delete", label: "حذف ملک" },
    ],
  },
  {
    group: "مشتریان",
    items: [
      { code: "customer:read", label: "مشاهده مشتریان" },
      { code: "customer:create", label: "ثبت مشتری" },
      { code: "customer:update", label: "ویرایش مشتری" },
    ],
  },
  {
    group: "بازدید و معامله",
    items: [
      { code: "visit:read", label: "مشاهده بازدیدها" },
      { code: "visit:create", label: "ثبت بازدید" },
      { code: "deal:read", label: "مشاهده معاملات" },
      { code: "deal:create", label: "ثبت معامله" },
      { code: "deal:update", label: "تغییر مرحله معامله" },
    ],
  },
  {
    group: "سازمان",
    items: [
      { code: "organization:read", label: "مشاهده سازمان" },
      { code: "organization:manage_members", label: "مدیریت اعضا" },
      { code: "role:read", label: "مشاهده نقش‌ها" },
      { code: "role:manage", label: "مدیریت نقش‌ها" },
    ],
  },
  {
    group: "یکپارچه‌سازی و AI",
    items: [
      { code: "integration:read", label: "مشاهده یکپارچه‌سازی" },
      { code: "integration:use", label: "استفاده از یکپارچه‌سازی" },
      { code: "ai:use", label: "استفاده از AI" },
    ],
  },
];

export default function RolesPage() {
  const { session } = useSession();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", title: "" });
  const [permSet, setPermSet] = useState<Set<string>>(new Set(["property:read", "property:create", "customer:read"]));

  const orgId = session?.organization_id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      setRoles((await api.listRoles(orgId)) as RoleItem[]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در بارگیری نقش‌ها");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!orgId) return;
    if (!form.code.trim() || !form.title.trim()) {
      toast.error("کد و عنوان نقش الزامی است");
      return;
    }
    setBusy(true);
    try {
      await api.createRole(orgId, { code: form.code.trim(), title: form.title.trim(), permission_codes: [...permSet] });
      toast.success("نقش سفارشی ساخته شد");
      setForm({ code: "", title: "" });
      setPermSet(new Set(["property:read", "property:create", "customer:read"]));
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ساخت نقش");
    } finally {
      setBusy(false);
    }
  };

  const togglePerm = (code: string) => {
    setPermSet((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const systemRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);

  return (
    <div className="animate-fade-in">
      <PageHead
        title="نقش‌ها و مجوزها"
        desc="RBAC سازمان‌محور — کش مجوز با TTL ۵ دقیقه و نسخه‌بندی"
        icon={<ShieldCheck className="h-5 w-5" />}
        action={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            نقش جدید
          </Button>
        }
      />

      {loading && roles.length === 0 ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-muted">
              <Lock className="h-3.5 w-3.5" />
              نقش‌های سیستمی ({faNum(systemRoles.length)}) — غیرقابل حذف
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {systemRoles.map((r) => (
                <Card key={r.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{r.title}</span>
                        <Code>{r.code}</Code>
                      </div>
                      <div className="mt-1.5 text-[10px] text-muted">{faNum(r.permissions.length)} مجوز</div>
                    </div>
                    <Badge tone="muted">سیستمی</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-muted">
              <ShieldCheck className="h-3.5 w-3.5" />
              نقش‌های سفارشی این سازمان ({faNum(customRoles.length)})
            </h2>
            {customRoles.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="نقش سفارشی ندارید"
                desc="نقش سفارشی بسازید تا مجوزها را دقیق‌تر به اعضای تیم بدهید."
                action={
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
                    ساخت نقش
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {customRoles.map((r) => (
                  <li key={r.id} className="animate-slide-up">
                    <Card className="h-full p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{r.title}</span>
                            <Code>{r.code}</Code>
                          </div>
                          <div className="mt-1 text-[10px] text-muted">سازمان #{r.organization_id}</div>
                        </div>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          aria-label="حذف نقش"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {r.permissions.slice(0, 6).map((p) => (
                          <span key={p} className="ltr rounded-md bg-raise px-1.5 py-0.5 font-mono text-[9px] text-muted" dir="ltr">
                            {p}
                          </span>
                        ))}
                        {r.permissions.length > 6 && <Badge tone="muted">+{faNum(r.permissions.length - 6)}</Badge>}
                        {r.permissions.length === 0 && <span className="text-[10px] text-muted">بدون مجوز</span>}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Card className="p-4 text-[10px] leading-5 text-muted">
            <b className="text-ink">چطور کار می‌کند؟</b> پس از هر تغییر نقش، نسخه مجوزها (permissions_version) افزایش می‌یابد و کش{" "}
            <Code>perms:user:org:version</Code> باطل می‌شود؛ بنابراین تغییرات بدون انتظار اعمال می‌گردد.
          </Card>
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        aria-label="نقش جدید"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop transition active:scale-95 sm:hidden dark:text-slate-900"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="ساخت نقش سفارشی" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="کد انگلیسی" hint="مثال: sales_manager">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" className="font-mono" />
            </Field>
            <Field label="عنوان فارسی" hint="مثال: مدیر فروش">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">مجوزها</span>
              <span className="text-[10px] text-muted">{faNum(permSet.size)} انتخاب‌شده</span>
            </div>
            <div className="space-y-3">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="mb-1.5 text-[10px] font-bold text-muted">{g.group}</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {g.items.map((item) => {
                      const active = permSet.has(item.code);
                      return (
                        <button
                          key={item.code}
                          onClick={() => togglePerm(item.code)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border p-2.5 text-start text-[11px] transition",
                            active ? "border-brand/50 bg-brand-soft text-brand dark:text-teal-200" : "border-line bg-raise text-muted hover:text-ink",
                          )}
                        >
                          <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", active ? "border-brand bg-brand text-white dark:text-slate-900" : "border-line")}>
                            {active && <Check className="h-3 w-3" />}
                          </span>
                          <span className="flex-1">{item.label}</span>
                          <span className="ltr font-mono text-[9px] opacity-60" dir="ltr">
                            {item.code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" size="lg" loading={busy} onClick={submit}>
            ساخت نقش با {faNum(permSet.size)} مجوز
          </Button>
        </div>
      </Modal>

      <Confirm
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="حذف نقش سفارشی"
        desc="اعضایی که این نقش را دارند مجوزهای مرتبط را از دست می‌دهند."
        confirmLabel="حذف نقش"
        onConfirm={async () => {
          if (!orgId || deleteId === null) return;
          try {
            await api.deleteRole(orgId, deleteId);
            toast.success("نقش حذف شد");
            await load();
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "خطا");
          }
        }}
      />
    </div>
  );
}
