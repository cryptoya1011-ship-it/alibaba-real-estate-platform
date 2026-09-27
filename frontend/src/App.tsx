import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { SessionProvider, useSession } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { ConfirmProvider } from "@/components/ui/confirm";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoader } from "@/components/layout/PageLoader";
import { LoginPage } from "@/features/auth/LoginPage";
import { OrgsPage } from "@/features/auth/OrgsPage";
import { NotFoundPage } from "@/features/auth/NotFoundPage";

// Route-level code splitting
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const PropertiesPage = lazy(() => import("@/features/properties/PropertiesPage"));
const CrmPage = lazy(() => import("@/features/crm/CrmPage"));
const VisitsPage = lazy(() => import("@/features/visits/VisitsPage"));
const DealsPage = lazy(() => import("@/features/deals/DealsPage"));
const TeamPage = lazy(() => import("@/features/team/TeamPage"));
const RolesPage = lazy(() => import("@/features/roles/RolesPage"));
const AIPage = lazy(() => import("@/features/ai/AIPage"));
const IntegrationsPage = lazy(() => import("@/features/integrations/IntegrationsPage"));
const PublicListPage = lazy(() => import("@/features/public/PublicListPage"));
const PublicPropertyPage = lazy(() => import("@/features/public/PublicPropertyPage"));
const FavoritesPage = lazy(() => import("@/features/favorites/FavoritesPage"));
const NotificationsPage = lazy(() => import("@/features/notifications/NotificationsPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();
  if (status === "loading") return <FullScreenLoader />;
  if (status !== "authenticated") {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}

function RequireOrg({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  if (session && !session.organization_id) {
    return <Navigate to={`/orgs?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!session?.user.is_super_admin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/** "/" — legacy `?view=public&code=` deep links + auth-aware redirect. */
function RootRedirect() {
  const { status, session } = useSession();
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code") || params.get("p") || params.get("property");
  if (code && params.get("view") === "public") return <Navigate to={`/p/${encodeURIComponent(code)}`} replace />;
  if (status === "loading") return <FullScreenLoader />;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return <Navigate to={session?.organization_id ? "/app" : "/orgs"} replace />;
}

/** /d/:code — deal deep link → deals page focused on that deal. */
function DealDeepLink() {
  const { code } = useParams();
  return <Navigate to={`/app/deals?code=${encodeURIComponent(code ?? "")}`} replace />;
}

export default function App() {
  const { theme } = useTheme();
  return (
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <ConfirmProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/orgs"
              element={
                <RequireAuth>
                  <OrgsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <RequireOrg>
                    <AppShell />
                  </RequireOrg>
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="crm" element={<CrmPage />} />
              <Route path="visits" element={<VisitsPage />} />
              <Route path="deals" element={<DealsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="ai" element={<AIPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="public" element={<PublicListPage />} />
              <Route path="favorites" element={<FavoritesPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="admin"
                element={
                  <RequireSuperAdmin>
                    <AdminPage />
                  </RequireSuperAdmin>
                }
              />
              <Route path="*" element={<NotFoundPage inShell />} />
            </Route>
            <Route
              path="/p/:code"
              element={
                <Suspense fallback={<FullScreenLoader label="در حال بارگذاری ملک…" />}>
                  <PublicPropertyPage />
                </Suspense>
              }
            />
            <Route path="/d/:code" element={<DealDeepLink />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster
            dir="rtl"
            position="top-center"
            theme={theme}
            richColors
            closeButton
            offset={16}
            mobileOffset={{ top: 12 }}
            toastOptions={{ className: "font-sans", duration: 3500 }}
          />
        </ConfirmProvider>
      </SessionProvider>
    </MotionConfig>
  );
}

