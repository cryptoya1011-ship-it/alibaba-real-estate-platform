import { motion } from "framer-motion";
import { Plus } from "lucide-react";

/** Mobile floating action button (sits above the bottom nav). */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] end-4 z-30 flex h-14 items-center gap-2 rounded-[18px] bg-gradient-primary px-5 font-semibold text-primary-foreground shadow-lg shadow-primary/30 lg:hidden"
    >
      <Plus className="size-5" aria-hidden />
      {label}
    </motion.button>
  );
}
