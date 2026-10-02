import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the project's custom type scale (styles.css `--text-*`).
// Without this, `text-title` is mistaken for a text *colour* and silently drops
// colour classes such as `text-primary-foreground` (dark text on primary buttons).
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["caption", "body", "title", "title-lg", "display", "display-lg"] } },
});

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
