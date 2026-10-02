import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError, api, onUnauthorized, setReauthHandler, setToken, type Session } from "@/api";
import { getWebApp, isInsideTelegram } from "@/telegram";
import { uid } from "@/lib/format";

const SESSION_KEY = "arep_session";
const LOGGED_OUT_KEY = "arep_logged_out";
/** "password" when the temporary username/password login was used (ADR-0023). */
const LOGIN_METHOD_KEY = "arep_login_method";

export type PasswordCredentials = { username: string; password: string };

type Status = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  session: Session | null;
  status: Status;
  insideTelegram: boolean;
  /**
   * Telegram initData login inside Telegram; devLogin(1000001) outside — or,
   * when credentials are given (temporary password login, ADR-0023), passwordLogin.
   */
  login: (credentials?: PasswordCredentials) => Promise<Session>;
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
      onUnauthorized((err) => {
        clear();
        // Several requests can fail at once — show a single toast (fixed id),
        // with the server's reason when it is more specific than "expired".
        const reason = err.message && !/^(خطای نامشخص|توکن نامعتبر است|Unauthorized)$/i.test(err.message) ? err.message : null;
        toast.error("نشست شما منقضی شد؛ لطفاً دوباره وارد شوید", { id: "session-expired", description: reason ?? undefined });
      }),
    [clear],
  );

  // Silent re-login when the token stops being valid (permissions changed,
  // invitation accepted, super-admin toggled, token expired…). The API layer
  // retries the failed request once with the new token; only if this fails is
  // the user sent back to the login screen.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    setReauthHandler(async () => {
      const previous = sessionRef.current;
      if (!previous) return false;
      const orgId = previous.organization_id ?? undefined;
      const tg = getWebApp();
      let next: Session;
      if (isInsideTelegram() && tg?.initData) {
        try {
          next = await api.loginTelegram(tg.initData, orgId);
        } catch {
          // Membership may have been removed — log in without an organization.
          next = await api.loginTelegram(tg.initData);
        }
      } else {
        // Password sessions cannot re-login silently (the password is never stored).
        if (localStorage.getItem(LOGIN_METHOD_KEY) === "password") return false;
        next = await api.devLogin(1000001);
        if (orgId && next.organization_id !== orgId && next.organizations.some((o) => o.id === orgId)) {
          setToken(next.access_token);
          next = await api.selectOrganization(orgId);
        }
      }
      // Same person? Compare the stable Telegram identity, not the database id:
      // after a database reset (e.g. a fresh dev/sandbox environment) the same
      // Telegram account can come back with a different user id.
      const samePerson =
        previous.user.telegram_id != null && next.user.telegram_id != null
          ? previous.user.telegram_id === next.user.telegram_id
          : previous.user.id === next.user.id;
      if (!samePerson) return false;
      apply(next);
      return true;
    });
    return () => setReauthHandler(null);
  }, [apply]);

  const login = useCallback(async (credentials?: PasswordCredentials) => {
    setStatus("loading");
    try {
      const tg = getWebApp();
      let next: Session;
      if (isInsideTelegram()) next = await api.loginTelegram(tg!.initData);
      else if (credentials) next = await api.passwordLogin(credentials.username, credentials.password);
      else next = await api.devLogin(1000001);
      try {
        if (credentials && !isInsideTelegram()) localStorage.setItem(LOGIN_METHOD_KEY, "password");
        else localStorage.removeItem(LOGIN_METHOD_KEY);
      } catch {
        /* ignore */
      }
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

/** Permission check that also treats super admins as allowed. */
export function useCan() {
  const { hasPermission, session } = useSession();
  const superAdmin = !!session?.user.is_super_admin;
  return useCallback((code: string) => superAdmin || hasPermission(code), [superAdmin, hasPermission]);
}
