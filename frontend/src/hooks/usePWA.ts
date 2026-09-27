import { useEffect, useSyncExternalStore } from "react";
import { isStandalone, setupInstallPrompt } from "@/pwa";

type State = { install: (() => void) | null; installed: boolean; updateAvailable: boolean };
let state: State = { install: null, installed: typeof window !== "undefined" ? isStandalone() : false, updateAvailable: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let initialised = false;
function init() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  setupInstallPrompt((prompt) => set({ install: prompt }));
  window.addEventListener("appinstalled", () => set({ install: null, installed: true }));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event: MessageEvent<{ type?: string }>) => {
      if (event.data && event.data.type === "SKIP_WAITING") set({ updateAvailable: true });
    });
  }
}
init();

/** PWA install prompt + installed flag + update-available flag. */
export function usePWA() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  useEffect(() => {
    set({ installed: isStandalone() });
  }, []);
  return {
    canInstall: Boolean(s.install) && !s.installed,
    installed: s.installed,
    updateAvailable: s.updateAvailable,
    install: () => {
      s.install?.();
      set({ install: null });
    },
  };
}
