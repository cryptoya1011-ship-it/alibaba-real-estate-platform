import { Link } from "react-router-dom";
import { Bell, Download, LogOut, Moon, Sun, Crown } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useUnread } from "@/hooks/useUnread";
import { useOnline } from "@/hooks/useOnline";
import { usePWA } from "@/hooks/usePWA";
import { useSession } from "@/hooks/useSession";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { faNum } from "@/lib/format";
import { roleLabel } from "@/lib/constants";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === "dark" ? "حالت روشن" : "حالت تیره"}>
      {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

export function OnlineDot() {
  const online = useOnline();
  return (
    <span
      role="status"
      aria-label={online ? "آنلاین" : "آفلاین"}
      title={online ? "آنلاین" : "آفلاین"}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium", online ? "text-success" : "bg-warning-soft text-warning")}
    >
      <span className={cn("size-2 rounded-full bg-current", !online && "animate-pulse-dot")} />
      <span className={cn(online && "sr-only")}>{online ? "آنلاین" : "آفلاین"}</span>
    </span>
  );
}

export function NotificationBell() {
  const { unread } = useUnread();
  return (
    <Link
      to="/app/notifications"
      aria-label={unread > 0 ? `اعلان‌ها — ${faNum(unread)} خوانده‌نشده` : "اعلان‌ها"}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
    >
      <Bell aria-hidden />
      {unread > 0 && (
        <span className="tnum absolute end-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-background">
          {unread > 99 ? "۹۹+" : faNum(unread)}
        </span>
      )}
    </Link>
  );
}

export function InstallButton({ withLabel = false }: { withLabel?: boolean }) {
  const { canInstall, install } = usePWA();
  if (!canInstall) return null;
  return (
    <Button variant="soft" size={withLabel ? "sm" : "icon"} onClick={install} aria-label="نصب اپلیکیشن">
      <Download aria-hidden />
      {withLabel && "نصب اپ"}
    </Button>
  );
}

export function UserMenu() {
  const { session, logout } = useSession();
  if (!session) return null;
  return (
    <DropdownMenu dir="rtl">
      <DropdownTrigger asChild>
        <button type="button" aria-label="حساب کاربری" className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
          <Avatar name={session.user.display_name} className="size-9" />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownLabel>
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-body font-semibold text-foreground">
              {session.user.display_name}
              {session.user.is_super_admin && <Crown className="size-4 text-accent" aria-label="سوپر ادمین" />}
            </span>
            <span className="flex flex-wrap gap-1">
              {session.roles.length ? session.roles.map((r) => <Badge key={r} tone="primary">{roleLabel(r)}</Badge>) : <Badge>بدون نقش</Badge>}
            </span>
          </span>
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownItem onSelect={logout} destructive>
          <LogOut aria-hidden />
          خروج از حساب
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}
