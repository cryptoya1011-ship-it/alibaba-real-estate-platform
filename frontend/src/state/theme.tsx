import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ theme: "light", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("arep_theme", theme);
    } catch {
      /* storage may be unavailable */
    }
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#070b12" : "#0d9488");
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

/** Toaster that follows the active theme & RTL layout. */
export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      dir="rtl"
      richColors
      closeButton
      toastOptions={{
        style: {
          fontFamily: "Vazirmatn, system-ui, Tahoma, sans-serif",
          fontSize: "12px",
          borderRadius: "14px",
          direction: "rtl",
        },
      }}
    />
  );
}
