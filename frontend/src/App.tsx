import { Suspense, lazy, useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AlertTriangle, Building2, Plus, RotateCcw } from "lucide-react";
import { SessionProvider, useSession } from "./state/session";
import { DataProvider } from "./state/data";
import { Shell } from "./components/shell";
import { Button, Card, Field, Input, Logo, Modal, Skeleton } from "./components/ui";
import PropertiesPage from "./features/properties";
import CrmPage from "./features/crm";
import VisitsPage from "./features/visits";
import DealsPage from "./features/deals";
import TeamPage from "./features/team";
import RolesPage from "./features/roles";
import AiPage from "./features/ai";
import IntegrationsPage from "./features/integrations";
const AdminPage = lazy(() => import("./features/admin"));
import PublicListPage from "./features/public-list";
import { FavoritesPage, NotificationsPage } from "./features/misc";
import { toast } from "sonner";

/** The authenticated app (everything except /p/:code). */
export default function App() {
  const [params] = useSearchParams();
  const legacyCode = params.get("code") || params.get("p") || params.get("property");
  if (params.get("view") === "public" && legacyCode) return <Navigate to={`/p/${legacyCode}`} replace />;

  return (
    <SessionProvider>
      <DataProvider>
        <Gate />
      </DataProvider>
    </SessionProvider>
  );
}

function Gate() {
  const { session, error, busy, retryLogin } = useSession();

  if (busy && !session) return <Splash />;
  if (error && !session) return <ErrorScreen message={error} onRetry={retryLogin} />;
  if (!session) return <ErrorScreen message="نشست معتبر نیست — دوباره تلاش کنید" onRetry={retryLogin} />;
  if (!session.organization_id) return <OrgGate />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<PropertiesPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/public" element={<PublicListPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route path="/d/:code" element={<Navigate to="/deals" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

/* ── Splash ──────────────────────────────────────────────────────────── */
function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <Logo size="lg" />
      <div className="text-center">
        <div className="text-sm font-bold">املاک علی‌بابا</div>
        <div className="mt-1 text-[10px] text-muted">در حال اتصال به سرور…</div>
      </div>
      <div className="w-40 space-y-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-2/3" />
      </div>
    </div>
  );
}

/* ── Error ───────────────────────────────────────────────────────────── */
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-sm font-bold">اتصال برقرار نشد</h1>
        <p className="mt-2 text-[11px] leading-6 text-muted">{message}</p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetry}>
            تلاش مجدد
          </Button>
        </div>
        <p className="mt-4 text-[9px] leading-5 text-muted">
          اگر آفلاین هستید، پس از برقراری اتصال دوباره تلاش کنید. صف همگام‌سازی (Outbox) محفوظ می‌ماند.
        </p>
      </Card>
    </div>
  );
}

/* ── Organization gate ───────────────────────────────────────────────── */
function OrgGate() {
  const { session, chooseOrganization, createOrganization } = useSession();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-md p-6 animate-slide-up">
        <div className="mb-5 flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-sm font-bold">انتخاب سازمان</h1>
            <p className="mt-0.5 text-[10px] text-muted">
              {session?.user.display_name} خوش آمدید — برای ادامه یک سازمان انتخاب یا بسازید
            </p>
          </div>
        </div>

        {session?.organizations.length === 0 ? (
          <div className="mb-4 rounded-xl border border-line bg-raise/60 p-4 text-center">
            <Building2 className="mx-auto mb-2 h-6 w-6 text-muted" />
            <div className="text-xs font-bold">هنوز عضوی از هیچ سازمانی نیستید</div>
            <p className="mt-1 text-[10px] leading-5 text-muted">اولین سازمان خود را بسازید تا بتوانید ملک، مشتری و معامله ثبت کنید.</p>
          </div>
        ) : (
          <ul className="mb-4 space-y-2">
            {session?.organizations.map((org) => (
              <li key={org.id}>
                <button
                  disabled={busyId !== null}
                  onClick={async () => {
                    setBusyId(org.id);
                    await chooseOrganization(org.id);
                    setBusyId(null);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-raise p-3 text-start transition hover:border-brand/50 hover:bg-surface disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold">{org.name}</div>
                    <div className="ltr mt-0.5 truncate font-mono text-[9px] text-muted" dir="ltr">
                      {org.slug}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {org.is_owner && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] text-gold">مالک</span>}
                    {busyId === org.id ? <Skeleton className="h-4 w-4 rounded-full" /> : <span className="text-[10px] text-brand dark:text-teal-300">انتخاب ›</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button className="w-full" size="lg" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          ساخت سازمان جدید
        </Button>

        <p className="mt-4 text-center text-[9px] leading-5 text-muted">
          ایزولیشن ۴ لایه: Context → Repository → RLS → Cache — داده هر سازمان کاملاً جدا نگهداری می‌شود.
        </p>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="ساخت سازمان جدید">
        <div className="space-y-4">
          <Field label="نام سازمان" hint="مثال: املاک علی‌بابا اصفهان">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام سازمان" />
          </Field>
          <Field label="شناسه انگلیسی (slug)" hint="حروف انگلیسی و خط تیره — در کدگذاری ملک استفاده می‌شود">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="alibaba-isf" dir="ltr" className="font-mono text-xs" />
          </Field>
          <Button
            className="w-full"
            size="lg"
            loading={creating}
            onClick={async () => {
              if (!name.trim() || !slug.trim()) {
                toast.error("نام و شناسه الزامی است");
                return;
              }
              setCreating(true);
              const ok = await createOrganization(name.trim(), slug.trim());
              setCreating(false);
              if (ok) {
                setName("");
                setSlug("");
                setOpen(false);
              }
            }}
          >
            ثبت سازمان
          </Button>
        </div>
      </Modal>
    </div>
  );
}
