import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, MoreVertical, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, mediaUrl } from "@/api";
import { invalidate } from "@/hooks/useApi";
import { useOnline } from "@/hooks/useOnline";
import type { PropertyMedia } from "@/lib/types";
import { cn } from "@/lib/cn";
import { faNum } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { errorMessage } from "@/components/ui/states";
import { MAX_PHOTOS, preparePhoto, validatePhoto } from "./photos";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/*";

type Pending = { id: string; name: string; preview: string };

function AddTile({ onFiles, disabled, count }: { onFiles: (files: File[]) => void; disabled?: boolean; count: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) onFiles(files);
  };
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border-strong bg-card-2 text-caption text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <ImagePlus className="size-6" aria-hidden />
        افزودن عکس
        <span className="tnum text-[11px]">
          {faNum(count)} از {faNum(MAX_PHOTOS)}
        </span>
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={onChange} />
    </>
  );
}

function Tile({
  src,
  alt,
  primary,
  busy,
  children,
}: {
  src: string;
  alt: string;
  primary?: boolean;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "relative aspect-[4/3] overflow-hidden rounded-[12px] bg-card-2 hairline",
        primary && "ring-2 ring-accent ring-offset-2 ring-offset-popover",
      )}
    >
      <img src={src} alt={alt} loading="lazy" decoding="async" className={cn("h-full w-full object-cover", busy && "opacity-50")} />
      {primary && (
        <span className="absolute start-1.5 top-1.5 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
          <Star className="size-3 fill-current" aria-hidden /> کاور
        </span>
      )}
      {busy && (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-6 animate-spin text-white drop-shadow" aria-hidden />
        </span>
      )}
      {children}
    </motion.div>
  );
}

/** Upload / reorder / cover / delete photos of an existing property. */
export function PhotoManager({
  propertyId,
  media,
  onChange,
  canEdit = true,
}: {
  propertyId: number;
  media: PropertyMedia[];
  onChange: (media: PropertyMedia[]) => void;
  canEdit?: boolean;
}) {
  const online = useOnline();
  const confirm = useConfirm();
  const [items, setItems] = useState<PropertyMedia[]>(media);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => setItems(media), [media]);

  const commit = (next: PropertyMedia[]) => {
    setItems(next);
    onChange(next);
    invalidate("properties", "public");
  };

  const upload = async (files: File[]) => {
    if (!online) {
      toast.error("برای آپلود عکس باید آنلاین باشید");
      return;
    }
    const room = MAX_PHOTOS - items.length;
    if (room <= 0) {
      toast.error(`حداکثر ${faNum(MAX_PHOTOS)} عکس برای هر ملک مجاز است`);
      return;
    }
    const valid: File[] = [];
    files.forEach((f) => {
      const problem = validatePhoto(f);
      if (problem) toast.error(problem);
      else valid.push(f);
    });
    const batch = valid.slice(0, room);
    if (valid.length > room) toast.warning(`فقط ${faNum(room)} عکس دیگر قابل افزودن است`);
    const queued: Pending[] = batch.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, preview: URL.createObjectURL(f) }));
    setPending((p) => [...p, ...queued]);

    let current = items;
    let ok = 0;
    for (let i = 0; i < batch.length; i += 1) {
      try {
        const prepared = await preparePhoto(batch[i]);
        const created = await api.uploadPropertyMedia(propertyId, prepared.blob, prepared.name);
        current = [...current, created];
        setItems(current);
        ok += 1;
      } catch (err) {
        toast.error(`${batch[i].name}: ${errorMessage(err, "آپلود ناموفق بود")}`);
      } finally {
        URL.revokeObjectURL(queued[i].preview);
        setPending((p) => p.filter((x) => x.id !== queued[i].id));
      }
    }
    if (ok > 0) {
      commit(current);
      toast.success(ok === 1 ? "عکس اضافه شد" : `${faNum(ok)} عکس اضافه شد`);
    }
  };

  const run = async (id: number, action: () => Promise<PropertyMedia[]>, success: string) => {
    setBusyId(id);
    try {
      commit(await action());
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err, "عملیات ناموفق بود"));
    } finally {
      setBusyId(null);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    const previous = items;
    // The first photo is always the cover (mirrors the backend rule).
    setItems(next.map((m, i) => ({ ...m, is_primary: i === 0 })));
    api
      .reorderPropertyMedia(
        propertyId,
        next.map((m) => m.id),
      )
      .then((list) => commit(list))
      .catch((err: unknown) => {
        setItems(previous);
        toast.error(errorMessage(err, "تغییر ترتیب ناموفق بود"));
      });
  };

  const remove = async (m: PropertyMedia) => {
    const yes = await confirm({
      title: "حذف عکس؟",
      description: "این عکس برای همیشه حذف می‌شود.",
      confirmLabel: "حذف",
      destructive: true,
    });
    if (yes) await run(m.id, () => api.deletePropertyMedia(propertyId, m.id), "عکس حذف شد");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <AnimatePresence initial={false}>
          {items.map((m, index) => (
            <Tile key={m.id} src={mediaUrl(m.file_path, "thumb") ?? ""} alt={m.file_name} primary={m.is_primary} busy={busyId === m.id}>
              {canEdit && (
                <DropdownMenu dir="rtl">
                  <DropdownTrigger
                    aria-label={`گزینه‌های عکس ${faNum(index + 1)}`}
                    className="absolute inset-0 flex items-start justify-end p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                      <MoreVertical className="size-4" aria-hidden />
                    </span>
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem disabled={m.is_primary} onSelect={() => void run(m.id, () => api.setPrimaryPropertyMedia(propertyId, m.id), "عکس کاور تغییر کرد")}>
                      <Star /> انتخاب به‌عنوان کاور
                    </DropdownItem>
                    <DropdownItem disabled={index === 0} onSelect={() => move(index, -1)}>
                      <ArrowRight /> انتقال به قبل
                    </DropdownItem>
                    <DropdownItem disabled={index === items.length - 1} onSelect={() => move(index, 1)}>
                      <ArrowLeft /> انتقال به بعد
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem destructive onSelect={() => void remove(m)}>
                      <Trash2 /> حذف عکس
                    </DropdownItem>
                  </DropdownContent>
                </DropdownMenu>
              )}
            </Tile>
          ))}
          {pending.map((p) => (
            <Tile key={p.id} src={p.preview} alt={p.name} busy />
          ))}
        </AnimatePresence>
        {canEdit && <AddTile onFiles={(f) => void upload(f)} disabled={!online || pending.length > 0} count={items.length + pending.length} />}
      </div>
      <p className="text-caption text-muted-foreground">
        {online
          ? "عکس‌ها پیش از ارسال کوچک می‌شوند و اطلاعات مکانی (GPS) آن‌ها حذف می‌شود. اولین عکس کاور آگهی است. روی هر عکس بزنید تا کاور، ترتیب یا حذف را انتخاب کنید."
          : "برای مدیریت عکس‌ها به اینترنت وصل شوید."}
      </p>
    </div>
  );
}

export type LocalPhoto = { id: string; file: File; preview: string };

/** Photo picker for a property that does not exist yet (uploaded right after creation). */
export function LocalPhotoPicker({ photos, onChange }: { photos: LocalPhoto[]; onChange: (photos: LocalPhoto[]) => void }) {
  const online = useOnline();
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const add = (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const valid = files.filter((f) => {
      const problem = validatePhoto(f);
      if (problem) toast.error(problem);
      return !problem;
    });
    if (valid.length > room) toast.warning(`حداکثر ${faNum(MAX_PHOTOS)} عکس`);
    onChange([
      ...photos,
      ...valid.slice(0, Math.max(0, room)).map((file, i) => ({ id: `${Date.now()}-${i}`, file, preview: URL.createObjectURL(file) })),
    ]);
  };
  const remove = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    onChange(photos.filter((p) => p.id !== id));
  };
  const makeCover = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) onChange([target, ...photos.filter((p) => p.id !== id)]);
  };

  if (!online) {
    return <p className="rounded-[12px] bg-card-2 p-3 text-caption text-muted-foreground hairline">در حالت آفلاین امکان افزودن عکس نیست؛ بعد از همگام‌سازی از صفحه ملک عکس اضافه کنید.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <AnimatePresence initial={false}>
          {photos.map((p, index) => (
            <Tile key={p.id} src={p.preview} alt={p.file.name} primary={index === 0}>
              <DropdownMenu dir="rtl">
                <DropdownTrigger
                  aria-label={`گزینه‌های عکس ${faNum(index + 1)}`}
                  className="absolute inset-0 flex items-start justify-end p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                    <MoreVertical className="size-4" aria-hidden />
                  </span>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem disabled={index === 0} onSelect={() => makeCover(p.id)}>
                    <Star /> انتخاب به‌عنوان کاور
                  </DropdownItem>
                  <DropdownItem destructive onSelect={() => remove(p.id)}>
                    <Trash2 /> حذف
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            </Tile>
          ))}
        </AnimatePresence>
        <AddTile onFiles={add} count={photos.length} />
      </div>
      <p className="text-caption text-muted-foreground">اولین عکس کاور آگهی است. عکس‌ها بلافاصله بعد از ثبت ملک آپلود می‌شوند.</p>
    </div>
  );
}

/** Upload local photos in order after a property is created. Returns how many succeeded. */
export async function uploadLocalPhotos(propertyId: number, photos: LocalPhoto[], onProgress?: (done: number) => void) {
  let ok = 0;
  for (let i = 0; i < photos.length; i += 1) {
    try {
      const prepared = await preparePhoto(photos[i].file);
      await api.uploadPropertyMedia(propertyId, prepared.blob, prepared.name);
      ok += 1;
    } catch (err) {
      toast.error(`${photos[i].file.name}: ${errorMessage(err, "آپلود ناموفق بود")}`);
    }
    onProgress?.(i + 1);
  }
  if (ok > 0) invalidate("properties", "public");
  return ok;
}
