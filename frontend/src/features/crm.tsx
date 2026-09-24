import { useState } from "react";
import { Phone, Sparkles, UserPlus, Users } from "lucide-react";
import { ApiError, api } from "../api";
import { faNum } from "../lib/format";
import type { MatchItem, PersonItem } from "../lib/types";
import { useData } from "../state/data";
import { Badge, Button, Card, EmptyState, Field, Input, ListSkeleton, MatchesList, Modal, PageHead, Select, Stat } from "../components/ui";
import { toast } from "sonner";

const ROLE_FA: Record<string, string> = {
  buyer: "خریدار",
  seller: "فروشنده",
  renter: "مستأجر",
  landlord: "مالک",
  tenant: "مستأجر",
  agent: "مشاور",
};

export default function CrmPage() {
  const { persons, reload, loading } = useData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", role: "buyer" });
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matching, setMatching] = useState(false);

  const submit = async () => {
    if (!form.first_name.trim()) {
      toast.error("نام الزامی است");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createPerson({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        phone: form.phone.trim() || null,
        roles: [form.role],
      });
      toast.success(`مشتری «${created.display_name}» ثبت شد`);
      setForm({ first_name: "", last_name: "", phone: "", role: "buyer" });
      setOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت مشتری");
    } finally {
      setBusy(false);
    }
  };

  const runMatch = async (person: PersonItem) => {
    setMatchFor(person.display_name);
    setMatching(true);
    setMatches([]);
    try {
      const reqs = (await api.listRequests({ person_id: person.id })) as { id: number }[];
      if (reqs.length === 0) {
        toast.info("برای این مشتری درخواستی ثبت نشده است");
        setMatchFor(null);
        return;
      }
      setMatches((await api.aiMatchRequest(reqs[0].id)) as MatchItem[]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تطبیق");
      setMatchFor(null);
    } finally {
      setMatching(false);
    }
  };

  const buyers = persons.filter((p) => p.roles?.some((r) => r.role === "buyer")).length;

  return (
    <div className="animate-fade-in">
      <PageHead
        title="مشتریان"
        desc="CRM — پروفایل مشتری و تطبیق هوشمند با املاک"
        icon={<Users className="h-5 w-5" />}
        action={
          <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            مشتری جدید
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="کل مشتریان" value={faNum(persons.length)} icon={<Users className="h-4 w-4" />} />
        <Stat label="خریدار" value={faNum(buyers)} tone="gold" icon={<UserPlus className="h-4 w-4" />} />
        <Stat label="با شماره تماس" value={faNum(persons.filter((p) => p.phone).length)} tone="ok" icon={<Phone className="h-4 w-4" />} />
      </div>

      {loading && persons.length === 0 ? (
        <ListSkeleton />
      ) : persons.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="مشتری‌ای ثبت نشده"
          desc="مشتریان را ثبت کنید تا برای آن‌ها بازدید، معامله و تطبیق AI بسازید."
          action={
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              ثبت مشتری
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {persons.map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${Math.min(i * 30, 250)}ms` }} className="animate-slide-up">
              <Card className="h-full p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-white dark:from-teal-400 dark:to-teal-600">
                    {p.display_name?.trim()?.charAt(0) ?? "؟"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{p.display_name}</div>
                    <div className="tnum mt-0.5 flex items-center gap-1.5 text-[10px] text-muted" dir="ltr">
                      <Phone className="h-3 w-3" />
                      {p.phone || "— بدون شماره —"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.roles?.length ? (
                    p.roles.map((r, idx) => (
                      <Badge key={idx} tone="brand">
                        {ROLE_FA[r.role] ?? r.role}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="muted">بدون نقش</Badge>
                  )}
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <Button variant="soft" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => runMatch(p)} className="w-full">
                    تطبیق درخواست با املاک
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setOpen(true)}
        aria-label="ثبت مشتری"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-pop transition active:scale-95 sm:hidden dark:text-slate-900"
      >
        <UserPlus className="h-6 w-6" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="ثبت مشتری جدید">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="نام">
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field label="نام خانوادگی">
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
          </div>
          <Field label="شماره موبایل">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="0913…" />
          </Field>
          <Field label="نقش">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="buyer">خریدار</option>
              <option value="seller">فروشنده</option>
              <option value="renter">مستأجر</option>
              <option value="landlord">مالک</option>
            </Select>
          </Field>
          <Button className="w-full" size="lg" loading={busy} onClick={submit}>
            ثبت مشتری
          </Button>
        </div>
      </Modal>

      <Modal open={!!matchFor} onClose={() => setMatchFor(null)} title={`تطبیق AI — ${matchFor ?? ""}`} wide>
        {matching ? (
          <ListSkeleton />
        ) : matches.length === 0 ? (
          <EmptyState title="تطبیقی پیدا نشد" desc="املاک فعلی با معیارهای این درخواست هم‌خوانی ندارند." />
        ) : (
          <MatchesList matches={matches} />
        )}
      </Modal>
    </div>
  );
}
