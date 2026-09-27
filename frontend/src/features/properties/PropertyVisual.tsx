import { Building, Building2, Castle, Factory, Home, LandPlot, Store, Trees } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { mediaUrl } from "@/api";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  apartment: Building2,
  residential: Home,
  villa: Castle,
  land: LandPlot,
  commercial: Store,
  office: Building,
  administrative: Building,
  garden: Trees,
  industrial: Factory,
  mixed_use: Building2,
};

const GRADIENTS = [
  "from-teal-500/35 via-emerald-500/15 to-transparent",
  "from-amber-400/35 via-orange-400/10 to-transparent",
  "from-sky-500/30 via-teal-400/10 to-transparent",
  "from-emerald-500/30 via-lime-400/10 to-transparent",
];

/** Property image with a tasteful gradient placeholder (gallery placeholder when no photo). */
export function PropertyVisual({
  image,
  type,
  seed = 0,
  className,
  alt,
  size = "thumb",
}: {
  /** Media key from the API (or an absolute/blob URL). */
  image?: string | null;
  type?: string;
  seed?: number;
  className?: string;
  alt: string;
  size?: "thumb" | "full";
}) {
  const Icon = ICONS[type ?? ""] ?? Building2;
  const src = mediaUrl(image, size);
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(src)}
        className={cn("h-full w-full bg-card-2 object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("relative grid h-full w-full place-items-center overflow-hidden bg-card-2", className)}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", GRADIENTS[Math.abs(seed) % GRADIENTS.length])} />
      <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.07]" preserveAspectRatio="none">
        <defs>
          <pattern id={`grid-${seed}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${seed})`} />
      </svg>
      <Icon className="relative size-10 text-foreground/35" strokeWidth={1.5} aria-hidden />
    </div>
  );
}
