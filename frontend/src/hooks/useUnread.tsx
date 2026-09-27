import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/api";

type UnreadContextValue = { unread: number; refresh: () => void; setUnread: (n: number) => void };
const UnreadContext = createContext<UnreadContextValue>({ unread: 0, refresh: () => {}, setUnread: () => {} });

/** Live unread-notification badge: polls every 30s and on "notifications" invalidation. */
export function UnreadProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) return;
    api
      .getUnreadCount()
      .then((r) => setUnread(r.unread_count))
      .catch(() => {
        /* badge is best-effort */
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const t = setInterval(refresh, 30_000);
    const onInvalidate = (e: Event) => {
      const keys = (e as CustomEvent<string[]>).detail ?? [];
      if (keys.includes("notifications")) refresh();
    };
    const onFocus = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("arep:invalidate", onInvalidate);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("arep:invalidate", onInvalidate);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, refresh]);

  return <UnreadContext.Provider value={{ unread, refresh, setUnread }}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
