import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, api, setToken, getOutbox, clearOutbox, type Session } from "../api";
import { getWebApp, isInsideTelegram } from "../telegram";
import { setupInstallPrompt, isStandalone, isOnline } from "../pwa";
import { toast } from "sonner";

type SessionCtx = {
  session: Session | null;
  error: string | null;
  busy: boolean;
  online: boolean;
  outboxCount: number;
  updateAvailable: boolean;
  installPrompt: (() => void) | null;
  isInstalled: boolean;
  retryLogin: () => void;
  chooseOrganization: (id: number) => Promise<void>;
  createOrganization: (name: string, slug: string) => Promise<boolean>;
  syncOutbox: () => Promise<void>;
  refreshOutbox: () => void;
};

const Ctx = createContext<SessionCtx | null>(null);

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside provider");
  return v;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [online, setOnline] = useState(isOnline());
  const [outboxCount, setOutboxCount] = useState(getOutbox().length);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(() => void) | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone());

  const applySession = useCallback((next: Session) => {
    setToken(next.access_token);
    setSession(next);
  }, []);

  const login = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const tg = getWebApp();
      tg?.ready();
      tg?.expand();
      if (isInsideTelegram()) applySession(await api.loginTelegram(tg!.initData));
      else applySession(await api.devLogin(1000001));
    } catch (err) {
      setError(err instanceof ApiError ? `${err.code}: ${err.message}` : "اتصال به سرور برقرار نشد — بک‌اند را روشن کنید");
    } finally {
      setBusy(false);
    }
  }, [applySession]);

  useEffect(() => {
    login();
  }, [login]);

  useEffect(() => {
    setupInstallPrompt((prompt) => setInstallPrompt(() => prompt));
    setIsInstalled(isStandalone());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("arep:online" as keyof WindowEventMap, onOnline);
    window.addEventListener("arep:offline" as keyof WindowEventMap, onOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if ((event as MessageEvent).data?.type === "SKIP_WAITING") setUpdateAvailable(true);
      });
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const refreshOutbox = useCallback(() => setOutboxCount(getOutbox().length), []);

  const chooseOrganization = useCallback(
    async (id: number) => {
      setBusy(true);
      try {
        applySession(await api.selectOrganization(id));
        toast.success("سازمان فعال شد");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "خطا در انتخاب سازمان");
      } finally {
        setBusy(false);
      }
    },
    [applySession],
  );

  const createOrganization = useCallback(
    async (name: string, slug: string) => {
      try {
        const org = await api.createOrganization(name, slug, `org-${Date.now()}`);
        const me = await api.selectOrganization(org.id);
        applySession(me);
        toast.success(`سازمان «${name}» ساخته شد`);
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "خطا در ساخت سازمان");
        return false;
      }
    },
    [applySession],
  );

  const syncOutbox = useCallback(async () => {
    if (!online) {
      toast.warning("هنوز آفلاین هستید");
      return;
    }
    const items = getOutbox();
    if (items.length === 0) {
      toast.info("صف همگام‌سازی خالی است");
      return;
    }
    let ok = 0;
    for (const item of items) {
      try {
        if (item.type === "create_property") {
          await api.createProperty(item.payload, `outbox-${item.id}`);
          ok++;
        }
      } catch (e) {
        console.error("outbox sync failed", e);
      }
    }
    clearOutbox();
    setOutboxCount(0);
    toast.success(`${ok} آیتم از صف همگام‌سازی ارسال شد`);
  }, [online]);

  return (
    <Ctx.Provider
      value={{
        session,
        error,
        busy,
        online,
        outboxCount,
        updateAvailable,
        installPrompt,
        isInstalled,
        retryLogin: login,
        chooseOrganization,
        createOrganization,
        syncOutbox,
        refreshOutbox,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
