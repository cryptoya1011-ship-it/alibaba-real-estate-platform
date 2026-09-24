import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/* Minimal browser APIs that jsdom does not (fully) implement. */
function shim(target: object, prop: string, value: unknown) {
  try {
    Object.defineProperty(target, prop, { writable: true, configurable: true, value });
  } catch {
    /* already provided by the environment — nothing to do */
  }
}

if (!window.matchMedia) {
  shim(window, "matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

shim(navigator, "clipboard", { writeText: async () => {} });

if (!("ResizeObserver" in window)) {
  shim(window, "ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});
