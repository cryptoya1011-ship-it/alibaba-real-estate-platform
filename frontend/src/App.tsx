import { useCallback, useEffect, useState } from "react";
import { ApiError, api, setToken, type Session } from "./api";
import { getWebApp, isInsideTelegram } from "./telegram";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const applySession = useCallback((next: Session) => {
    setToken(next.access_token);
    setSession(next);
  }, []);

  useEffect(() => {
    const tg = getWebApp();
    tg?.ready();
    tg?.expand();

    (async () => {
      try {
        if (isInsideTelegram()) {
          applySession(await api.loginTelegram(tg!.initData));
        } else {
          // Outside Telegram (browser testing) fall back to the dev endpoint.
          applySession(await api.devLogin(1000001));
        }
      } catch (err) {
        setError(err instanceof ApiError ? `${err.code}: ${err.message}` : "اتصال به سرور برقرار نشد");
      } finally {
        setBusy(false);
      }
    })();
  }, [applySession]);

  const chooseOrganization = async (id: number) => {
    setBusy(true);
    try {
      applySession(await api.selectOrganization(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در انتخاب سازمان");
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <main className="card">در حال بارگذاری…</main>;
  if (error) return <main className="card error">{error}</main>;
  if (!session) return <main className="card error">نشست معتبر نیست</main>;

  return (
    <main className="card">
      <h1>املاک علی‌بابا</h1>
      <p className="muted">پلتفرم مدیریت املاک — فاز اول</p>

      <section>
        <h2>کاربر</h2>
        <p>{session.user.display_name}</p>
        <p className="muted">شناسه تلگرام: {session.user.telegram_id ?? "—"}</p>
      </section>

      <section>
        <h2>سازمان فعال</h2>
        {session.organization_id ? (
          <>
            <p>#{session.organization_id}</p>
            <p className="muted">نقش‌ها: {session.roles.join(", ") || "—"}</p>
            <p className="muted">تعداد دسترسی‌ها: {session.permissions.length}</p>
          </>
        ) : (
          <p className="muted">سازمانی انتخاب نشده است</p>
        )}
      </section>

      <section>
        <h2>سازمان‌های من</h2>
        {session.organizations.length === 0 && <p className="muted">عضو هیچ سازمانی نیستید</p>}
        <ul>
          {session.organizations.map((org) => (
            <li key={org.id}>
              <button onClick={() => chooseOrganization(org.id)}>
                {org.name} {org.is_owner ? "(مالک)" : ""}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
