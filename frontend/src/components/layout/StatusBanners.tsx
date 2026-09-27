import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, RefreshCw, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { useOutbox } from "@/hooks/useOutbox";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { faNum } from "@/lib/format";

/** Offline banner · outbox queue · update prompt. */
export function StatusBanners() {
  const online = useOnline();
  const { count, sync, syncing } = useOutbox();
  const { updateAvailable } = usePWA();

  return (
    <div className="flex flex-col gap-2 empty:hidden">
      <AnimatePresence initial={false}>
        {!online && (
          <motion.div
            key="offline"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="status"
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-[14px] border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-body">
              <WifiOff className="size-5 shrink-0 text-warning" aria-hidden />
              <div className="flex-1">
                <p className="font-semibold">آفلاین هستید</p>
                <p className="text-caption text-muted-foreground">ملک‌های جدید در صف ذخیره و پس از اتصال همگام می‌شوند.</p>
              </div>
              {count > 0 && (
                <span className="tnum rounded-full bg-warning/20 px-2.5 py-0.5 text-caption font-bold text-warning">صف {faNum(count)}</span>
              )}
            </div>
          </motion.div>
        )}
        {online && count > 0 && (
          <motion.div
            key="outbox"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-[14px] border border-primary/25 bg-primary-soft px-3.5 py-2.5">
              <CloudUpload className="size-5 shrink-0 text-primary" aria-hidden />
              <p className="flex-1 text-body">
                <span className="tnum font-bold">{faNum(count)}</span> مورد در صف همگام‌سازی
              </p>
              <Button size="sm" onClick={sync} loading={syncing}>
                همگام‌سازی
              </Button>
            </div>
          </motion.div>
        )}
        {updateAvailable && (
          <motion.div key="update" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 rounded-[14px] border border-accent/30 bg-accent-soft px-3.5 py-2.5">
              <RefreshCw className="size-5 shrink-0 text-accent" aria-hidden />
              <p className="flex-1 text-body">نسخه جدید آماده است</p>
              <Button size="sm" variant="accent" onClick={() => window.location.reload()}>
                به‌روزرسانی
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
