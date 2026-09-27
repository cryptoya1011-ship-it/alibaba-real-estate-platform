import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError, api, onUnauthorized, setToken, type Session } from "@/api";
import { getWebApp, isInsideTelegram } from "@/telegram";
import { uid } from "@/lib/format";

const SESSION_KEY = "arep_session";
const LOGGED_OUT_KEY = "arep_logged_out";

type Status = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  session: Session | null;
  status: Status;
  insideTelegram: boolean;
  /** Telegram initData login inside Telegram; devLogin(1000001) outside. */
  login: () => Promise<Session>;
  logout: () => void;
  selectOrganization: (id: number) => Promise<Session>;
  createOrganization: (name: string, slug: string) => Promise<Session>;
  hasPermission: (code: string) => boolean;
  currentOrg: Session["organizations"][number] | null;
  userLoggedOut: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function loadStored(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.access_token || (s.expires_at && new Date(s.expires_at).getTime() <= Date.now())) return null;
    return s;
  } catch {
    return null;
  }
}

function persist(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadStored();
    if (s) setToken(s.access_token);
    else setToken(null);
    return s;
  });
  const [status, setStatus] = useState<Status>(() => (session ? "authenticated" : "unauthenticated"));
  const insideTelegram = isInsideTelegram();

  const apply = useCallback((next: Session) => {
    setToken(next.access_token);
    persist(next);
    setSession(next);
    setStatus("authenticated");
    try {
      sessionStorage.removeItem(LOGGED_OUT_KEY);
    } catch {
      /* ignore */
    }
    return next;
  }, []);

  const clear = useCallback(() => {
    setToken(null);
    persist(null);
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    const tg = getWebApp();
    tg?.ready();
    tg?.expand();
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        clear();
        toast.error("نشست شما منقضی شد؛ لطفاً دوباره وارد شوید");
      }),
    [clear],
  );

  const login = useCallback(async () => {
    setStatus("loading");
    try {
      const tg = getWebApp();
      const next = isInsideTelegram() ? await api.loginTelegram(tg!.initData) : await api.devLogin(1000001);
      return apply(next);
    } catch (err) {
      setStatus("unauthenticated");
      throw err;
    }
  }, [apply]);

  const logout = useCallback(() => {
    try {
      sessionStorage.setItem(LOGGED_OUT_KEY, "1");
    } catch {
      /* ignore */
    }
    clear();
    toast.success("از حساب خارج شدید");
  }, [clear]);

  const selectOrganization = useCallback(async (id: number) => apply(await api.selectOrganization(id)), [apply]);

  const createOrganization = useCallback(
    async (name: string, slug: string) => {
      const org = await api.createOrganization(name, slug, uid("org"));
      return apply(await api.selectOrganization(org.id));
    },
    [apply],
  );

  const value = useMemo<SessionContextValue>(() => {
    const perms = new Set(session?.permissions ?? []);
    let userLoggedOut = false;
    try {
      userLoggedOut = sessionStorage.getItem(LOGGED_OUT_KEY) === "1";
    } catch {
      /* ignore */
    }
    return {
      session,
      status,
      insideTelegram,
      login,
      logout,
      selectOrganization,
      createOrganization,
      hasPermission: (code: string) => perms.has(code),
      currentOrg: session?.organizations.find((o) => o.id === session.organization_id) ?? null,
      userLoggedOut,
    };
  }, [session, status, insideTelegram, login, logout, selectOrganization, createOrganization]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Session that is guaranteed to exist with an active organization (inside /app). */
export function useOrgSession() {
  const ctx = useSession();
  if (!ctx.session || !ctx.session.organization_id) throw new Error("No active organization");
  return { ...ctx, session: ctx.session, orgId: ctx.session.organization_id };
}

export { ApiError };
