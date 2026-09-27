import { useSyncExternalStore } from "react";
import { isOnline } from "@/pwa";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  window.addEventListener("arep:online", cb);
  window.addEventListener("arep:offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
    window.removeEventListener("arep:online", cb);
    window.removeEventListener("arep:offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
