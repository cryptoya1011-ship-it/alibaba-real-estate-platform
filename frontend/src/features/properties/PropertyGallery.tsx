import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { mediaUrl } from "@/api";
import { cn } from "@/lib/cn";
import { faNum } from "@/lib/format";
import { PropertyVisual } from "./PropertyVisual";

/**
 * Swipeable photo gallery (scroll-snap, works with touch + keyboard) with a
 * thumbnail strip and a full-screen viewer. Falls back to the gradient
 * placeholder when a property has no photos.
 */
export function PropertyGallery({
  images,
  type,
  seed,
  alt,
  overlay,
  className,
  emptyLabel = "تصویری بارگذاری نشده",
}: {
  /** Media keys, cover first. */
  images: string[];
  type?: string;
  seed: number;
  alt: string;
  overlay?: ReactNode;
  className?: string;
  emptyLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const count = images.length;

  useEffect(() => {
    if (active >= count) setActive(0);
  }, [count, active]);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActive(index);
  }, []);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    // scrollLeft is negative in RTL (Chrome/Firefox) — use the magnitude.
    const index = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
    if (index !== active && index < count) setActive(index);
  };

  if (count === 0) {
    return (
      <div className={cn("relative overflow-hidden rounded-[16px]", className)}>
        <PropertyVisual type={type} seed={seed} alt={alt} />
        <span className="absolute bottom-3 end-3 rounded-full bg-black/45 px-3 py-1 text-caption text-white backdrop-blur">{emptyLabel}</span>
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("group relative overflow-hidden rounded-[16px] bg-card-2", className)}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          aria-roledescription="گالری"
          aria-label={`تصاویر ${alt}`}
        >
          {images.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewer(i)}
              className="relative h-full w-full shrink-0 snap-center"
              aria-label={`نمایش تمام‌صفحه تصویر ${faNum(i + 1)} از ${faNum(count)}`}
            >
              <PropertyVisual image={key} size="full" type={type} seed={seed} alt={`${alt} — تصویر ${faNum(i + 1)}`} />
            </button>
          ))}
        </div>
        {overlay}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(Math.max(0, active - 1))}
              disabled={active === 0}
              aria-label="تصویر قبلی"
              className="absolute start-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition disabled:opacity-0"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(Math.min(count - 1, active + 1))}
              disabled={active === count - 1}
              aria-label="تصویر بعدی"
              className="absolute end-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition disabled:opacity-0"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          </>
        )}
        <span className="tnum pointer-events-none absolute end-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[12px] text-white backdrop-blur">
          <Expand className="size-3.5" aria-hidden />
          {faNum(active + 1)} / {faNum(count)}
        </span>
      </div>

      {count > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {images.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`تصویر ${faNum(i + 1)}`}
              aria-pressed={i === active}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-[10px] ring-2 transition",
                i === active ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={mediaUrl(key, "thumb") ?? ""} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <Lightbox images={images} index={viewer} onIndex={setViewer} alt={alt} />
    </div>
  );
}

function Lightbox({ images, index, onIndex, alt }: { images: string[]; index: number | null; onIndex: (i: number | null) => void; alt: string }) {
  const count = images.length;
  const prev = () => index !== null && onIndex((index - 1 + count) % count);
  const next = () => index !== null && onIndex((index + 1) % count);
  return (
    <DialogPrimitive.Root open={index !== null} onOpenChange={(open) => !open && onIndex(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/90 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[70] flex flex-col outline-none"
          onKeyDown={(e) => {
            // RTL: the right arrow goes to the previous photo.
            if (e.key === "ArrowRight") prev();
            if (e.key === "ArrowLeft") next();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">نمایش تمام‌صفحه تصاویر</DialogPrimitive.Description>
          <div className="flex items-center justify-between p-3 pt-safe text-white">
            <span className="tnum text-body">{index !== null ? `${faNum(index + 1)} / ${faNum(count)}` : ""}</span>
            <DialogPrimitive.Close aria-label="بستن" className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-safe">
            {index !== null && (
              <img src={mediaUrl(images[index], "full") ?? ""} alt={`${alt} — تصویر ${faNum(index + 1)}`} className="max-h-full max-w-full rounded-[8px] object-contain" />
            )}
            {count > 1 && (
              <>
                <button type="button" onClick={prev} aria-label="تصویر قبلی" className="absolute start-2 grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <ChevronRight className="size-6" aria-hidden />
                </button>
                <button type="button" onClick={next} aria-label="تصویر بعدی" className="absolute end-2 grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Cover-first ordering of a property's media keys. */
export function orderedImageKeys(media: { file_path: string; is_primary: boolean; file_type?: string }[] | undefined): string[] {
  if (!media?.length) return [];
  const images = media.filter((m) => !m.file_type || m.file_type === "image");
  const cover = images.find((m) => m.is_primary);
  return [...(cover ? [cover] : []), ...images.filter((m) => m !== cover)].map((m) => m.file_path);
}
