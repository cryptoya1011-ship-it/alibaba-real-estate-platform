import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const KEY = "arep_theme";
const listeners = new Set<() => void>();

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function read(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return systemTheme();
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0B1220" : "#F6F4EF");
}

let current: Theme = typeof window !== "undefined" ? read() : "dark";

function setTheme(theme: Theme, persist = true) {
  current = theme;
  if (persist) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }
  apply(theme);
  listeners.forEach((l) => l());
}

/** Theme store: dark default, persisted, follows prefers-color-scheme until the user picks. */
export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );

  useEffect(() => {
    apply(current);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(KEY);
      } catch {
        /* ignore */
      }
      if (!stored) setTheme(systemTheme(), false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => setTheme(current === "dark" ? "light" : "dark"), []);
  return { theme, setTheme, toggle };
}
