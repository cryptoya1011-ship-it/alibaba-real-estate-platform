import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { UnreadProvider } from "@/hooks/useUnread";
import { useSession } from "@/hooks/useSession";
import { NAV_ITEMS } from "@/lib/nav";
import { Brand } from "./Brand";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MoreSheet } from "./MoreSheet";
import { CommandPalette } from "./CommandPalette";
import { OrgSwitcher } from "./OrgSwitcher";
import { StatusBanners } from "./StatusBanners";
import { InstallButton, NotificationBell, OnlineDot, ThemeToggle, UserMenu } from "./TopbarActions";
import { PageLoader } from "./PageLoader";

export function AppShell() {
  const { session } = useSession();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.mobilePrimary).map((i) => i.to);
  const moreActive = location.pathname.startsWith("/app/") && !primary.some((p) => p !== "/app" && location.pathname.startsWith(p));

  return (
    <UnreadProvider enabled={!!session?.organization_id}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 pt-safe backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-5 lg:h-16">
              <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
                <Brand compact />
                <OrgSwitcher compact />
              </div>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-10 w-full max-w-md items-center gap-2 rounded-[12px] bg-card-2 px-3 text-body text-muted-foreground transition hairline hover:border-border-strong lg:flex"
              >
                <Search className="size-4" aria-hidden />
                <span className="flex-1 text-start">جستجوی بخش یا فرمان…</span>
                <kbd dir="ltr" className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">Ctrl K</kbd>
              </button>
              <div className="ms-auto flex items-center gap-0.5">
                <OnlineDot />
                <InstallButton />
                <button type="button" onClick={() => setPaletteOpen(true)} aria-label="جستجو" className="grid size-11 place-items-center rounded-[12px] text-foreground hover:bg-muted lg:hidden">
                  <Search className="size-[18px]" aria-hidden />
                </button>
                <ThemeToggle />
                <NotificationBell />
                <div className="hidden ps-1 lg:block">
                  <UserMenu />
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-3 sm:px-5 lg:pb-10 lg:pt-6">
            <StatusBanners />
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pt-3"
            >
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </main>
        </div>
      </div>
      <BottomNav onMore={() => setMoreOpen(true)} moreActive={moreActive || moreOpen} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </UnreadProvider>
  );
}
