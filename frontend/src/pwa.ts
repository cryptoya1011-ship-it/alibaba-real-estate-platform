/**
 * PWA registration helper — vite-plugin-pwa autoUpdate
 * Handles install prompt, update notification, offline detection
 */

export function registerPWA() {
  if ("serviceWorker" in navigator) {
    // vite-plugin-pwa injects virtual module for registration
    // but we also support manual registration fallback
    window.addEventListener("load", () => {
      // The plugin auto-registers, we just listen for events
      console.log("[PWA] Service Worker support detected");
    });

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] New Service Worker activated");
    });
  }

  // Offline detection
  window.addEventListener("online", () => {
    console.log("[PWA] Online");
    window.dispatchEvent(new CustomEvent("arep:online"));
  });
  window.addEventListener("offline", () => {
    console.log("[PWA] Offline");
    window.dispatchEvent(new CustomEvent("arep:offline"));
  });
}

// Install prompt handling
let deferredPrompt: any = null;

export function setupInstallPrompt(onAvailable: (prompt: () => void) => void) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("[PWA] Install prompt available");
    onAvailable(() => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice: any) => {
          console.log("[PWA] Install choice", choice);
          deferredPrompt = null;
        });
      }
    });
  });

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] App installed");
    deferredPrompt = null;
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function isOnline(): boolean {
  return navigator.onLine;
}
