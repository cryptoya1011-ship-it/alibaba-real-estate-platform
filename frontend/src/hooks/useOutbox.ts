import { useCallback, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, getOutbox, onOutboxChange, removeFromOutbox, type OutboxItem } from "@/api";
import { faNum } from "@/lib/format";
import { invalidate } from "./useApi";

let snapshot: OutboxItem[] = getOutbox();
let snapshotRaw = JSON.stringify(snapshot);

function subscribe(cb: () => void) {
  return onOutboxChange(() => {
    const next = getOutbox();
    const raw = JSON.stringify(next);
    if (raw !== snapshotRaw) {
      snapshot = next;
      snapshotRaw = raw;
    }
    cb();
  });
}

/** Offline outbox (localStorage `arep_outbox`) + replay with the original idempotency keys. */
export function useOutbox() {
  const items = useSyncExternalStore(subscribe, () => snapshot);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.warning("هنوز آفلاین هستید؛ پس از اتصال دوباره تلاش کنید");
      return;
    }
    const queue = getOutbox();
    if (queue.length === 0) {
      toast.info("صف همگام‌سازی خالی است");
      return;
    }
    setSyncing(true);
    let ok = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        if (item.type === "create_property") {
          await api.createProperty(item.payload, `outbox-${item.id}`);
          removeFromOutbox(item.id);
          ok++;
        }
      } catch (e) {
        console.error("outbox sync failed", e);
        failed++;
      }
    }
    setSyncing(false);
    invalidate("properties", "dashboard");
    if (ok > 0) toast.success(`${faNum(ok)} مورد با موفقیت همگام شد`);
    if (failed > 0) toast.error(`${faNum(failed)} مورد همگام نشد و در صف باقی ماند`);
  }, []);

  return { items, count: items.length, sync, syncing };
}
