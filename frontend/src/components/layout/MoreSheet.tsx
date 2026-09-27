import { Link } from "react-router-dom";
import { CloudUpload, Crown, LogOut, Moon, Sun } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useUnread } from "@/hooks/useUnread";
import { useTheme } from "@/hooks/useTheme";
import { useOutbox } from "@/hooks/useOutbox";
import { visibleNav } from "@/lib/nav";
import { faNum } from "@/lib/format";
import { roleLabel } from "@/lib/constants";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { InstallButton } from "./TopbarActions";

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { session, logout } = useSession();
  const { unread } = useUnread();
  const { theme, toggle } = useTheme();
  const { count, sync, syncing } = useOutbox();
  const items = visibleNav(!!session?.user.is_super_admin).filter((i) => !i.mobilePrimary);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" title="بیشتر" description="همه بخش‌ها و تنظیمات">
        {session && (
          <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-card-2 p-3 hairline">
            <Avatar name={session.user.display_name} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-semibold">
                {session.user.display_name}
                {session.user.is_super_admin && <Crown className="size-4 text-accent" aria-label="سوپر ادمین" />}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {session.roles.map((r) => (
                  <Badge key={r} tone="primary">{roleLabel(r)}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}
        <ul className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                onClick={() => onOpenChange(false)}
                className="relative flex aspect-[1.05] flex-col items-center justify-center gap-2 rounded-[16px] bg-card-2 p-2 text-center text-caption font-medium transition hairline hover:bg-muted active:scale-[0.97]"
              >
                <span className={item.superAdminOnly ? "grid size-10 place-items-center rounded-[12px] bg-accent-soft text-accent" : "grid size-10 place-items-center rounded-[12px] bg-primary-soft text-primary"}>
                  <item.icon className="size-5" aria-hidden />
                </span>
                {item.short ?? item.label}
                {item.key === "notifications" && unread > 0 && (
                  <span className="tnum absolute end-2 top-2 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-[18px] text-white">{faNum(unread)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="secondary" block onClick={toggle}>
            {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {theme === "dark" ? "حالت روشن" : "حالت تیره"}
          </Button>
          {count > 0 && (
            <Button variant="soft" block onClick={sync} loading={syncing}>
              <CloudUpload aria-hidden />
              همگام‌سازی صف ({faNum(count)})
            </Button>
          )}
          <InstallButton withLabel />
          <Button
            variant="danger"
            block
            onClick={() => {
              onOpenChange(false);
              logout();
            }}
          >
            <LogOut aria-hidden />
            خروج از حساب
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
