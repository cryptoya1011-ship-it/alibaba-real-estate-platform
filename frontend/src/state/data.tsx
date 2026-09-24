import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";
import { useSession } from "./session";
import type { PropertyListItem, PersonItem, VisitItem, DealItem, PublicProperty, NotificationItem } from "../lib/types";

type DataCtx = {
  properties: PropertyListItem[];
  persons: PersonItem[];
  visits: VisitItem[];
  deals: DealItem[];
  favorites: { id: number; property_id: number }[];
  notifications: NotificationItem[];
  unreadCount: number;
  publicProps: PublicProperty[];
  loading: boolean;
  reload: () => Promise<void>;
  reloadPublic: () => Promise<void>;
};

const Ctx = createContext<DataCtx | null>(null);

export function useData(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside provider");
  return v;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [persons, setPersons] = useState<PersonItem[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [favorites, setFavorites] = useState<{ id: number; property_id: number }[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [publicProps, setPublicProps] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!session?.organization_id) return;
    setLoading(true);
    try {
      const [props, personsList, visitsList, dealsList, favs, notifs, unread] = await Promise.all([
        api.listProperties({ limit: 50 }),
        api.listPersons({ limit: 50 }),
        api.listVisits({ limit: 50 }),
        api.listDeals({ limit: 50 }),
        api.listFavorites(),
        api.listNotifications({ limit: 50 }),
        api.getUnreadCount(),
      ]);
      setProperties(props as PropertyListItem[]);
      setPersons(personsList as PersonItem[]);
      setVisits(visitsList as VisitItem[]);
      setDeals(dealsList as DealItem[]);
      setFavorites(favs as { id: number; property_id: number }[]);
      setNotifications(notifs as NotificationItem[]);
      setUnreadCount((unread as { unread_count: number }).unread_count);
    } catch (err) {
      console.error("loadAll failed", err);
    } finally {
      setLoading(false);
    }
  }, [session?.organization_id]);

  const reloadPublic = useCallback(async () => {
    try {
      const list = await api.publicListProperties({ limit: 50 });
      setPublicProps(list as PublicProperty[]);
    } catch (e) {
      console.error("public list failed", e);
    }
  }, []);

  useEffect(() => {
    if (session?.organization_id) {
      reload();
      reloadPublic();
    }
  }, [session?.organization_id, reload, reloadPublic]);

  return (
    <Ctx.Provider
      value={{ properties, persons, visits, deals, favorites, notifications, unreadCount, publicProps, loading, reload, reloadPublic }}
    >
      {children}
    </Ctx.Provider>
  );
}
