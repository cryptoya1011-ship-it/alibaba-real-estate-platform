import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

const INVALIDATE_EVENT = "arep:invalidate";

/** Tell every mounted useApi() subscribed to any of these keys to refetch. */
export function invalidate(...keys: string[]) {
  window.dispatchEvent(new CustomEvent<string[]>(INVALIDATE_EVENT, { detail: keys }));
}

type Options = { enabled?: boolean; keys?: string[] };

export type ApiState<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
};

/** Minimal data hook: loading / error / retry + key-based invalidation. */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList, options: Options = {}): ApiState<T> {
  const { enabled = true, keys = [] } = options;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(async (silent: boolean) => {
    const id = ++requestId.current;
    if (silent && hasData.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      hasData.current = true;
      setDataState(result);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    hasData.current = false;
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const keysSig = keys.join("|");
  useEffect(() => {
    if (!enabled || keysSig === "") return;
    const mine = keysSig.split("|");
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail ?? [];
      if (detail.some((k) => mine.includes(k))) void run(true);
    };
    window.addEventListener(INVALIDATE_EVENT, handler);
    return () => window.removeEventListener(INVALIDATE_EVENT, handler);
  }, [enabled, keysSig, run]);

  const reload = useCallback(() => run(true), [run]);
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater));
  }, []);

  return { data, error, loading, refreshing, reload, setData };
}
