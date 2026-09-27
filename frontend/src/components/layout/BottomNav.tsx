import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";

/** Mobile bottom navigation — 5 primary destinations + «بیشتر». */
export function BottomNav({ onMore, moreActive }: { onMore: () => void; moreActive: boolean }) {
  const items = NAV_ITEMS.filter((i) => i.mobilePrimary);
  const cell =
    "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors";
  return (
    <nav
      aria-label="ناوبری پایین"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-xl items-stretch px-1">
        {items.map((item) => (
          <li key={item.key} className="flex flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(cell, isActive ? "text-primary" : "text-muted-foreground")}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      className="absolute top-1.5 h-8 w-14 rounded-full bg-primary-soft"
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    />
                  )}
                  <item.icon className="relative mt-0.5 size-[22px]" strokeWidth={isActive ? 2.3 : 1.9} aria-hidden />
                  <span className="relative truncate">{item.short ?? item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} className={cn(cell, moreActive ? "text-primary" : "text-muted-foreground")}>
            {moreActive && <span className="absolute top-1.5 h-8 w-14 rounded-full bg-primary-soft" />}
            <LayoutGrid className="relative mt-0.5 size-[22px]" aria-hidden />
            <span className="relative">بیشتر</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
