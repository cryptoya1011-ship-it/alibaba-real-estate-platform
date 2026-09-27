import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useUnread } from "@/hooks/useUnread";
import { NAV_GROUPS, visibleNav } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { faNum } from "@/lib/format";
import { roleLabel } from "@/lib/constants";
import { Avatar } from "@/components/ui/misc";
import { Brand } from "./Brand";
import { OrgSwitcher } from "./OrgSwitcher";

/** Desktop (≥1024px) right-side sidebar — RTL. */
export function Sidebar() {
  const { session } = useSession();
  const { unread } = useUnread();
  const items = visibleNav(!!session?.user.is_super_admin);
  return (
    <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-e border-border bg-background-2/60 lg:flex">
      <div className="flex flex-col gap-4 p-4 pb-3">
        <Brand />
        <OrgSwitcher />
      </div>
      <nav aria-label="منوی اصلی" className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group.key);
          if (!groupItems.length) return null;
          return (
            <div key={group.key} className="mt-2.5 first:mt-0">
              <p className="px-3 pb-1.5 text-[11px] font-semibold text-muted-foreground/80">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {groupItems.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          "relative flex h-9 items-center gap-3 rounded-[11px] px-3 text-body font-medium transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId="sidebar-active"
                              className="absolute inset-0 rounded-[11px] bg-primary-soft"
                              transition={{ type: "spring", stiffness: 420, damping: 36 }}
                            />
                          )}
                          <item.icon className="relative size-[18px]" aria-hidden />
                          <span className="relative flex-1">{item.label}</span>
                          {item.key === "notifications" && unread > 0 && (
                            <span className="tnum relative rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white">{faNum(unread)}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      {session && (
        <div className="m-3 mt-0 flex items-center gap-3 rounded-[14px] bg-card p-3 hairline">
          <Avatar name={session.user.display_name} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate font-semibold">
              {session.user.display_name}
              {session.user.is_super_admin && <Crown className="size-4 text-accent" aria-label="سوپر ادمین" />}
            </p>
            <p className="truncate text-caption text-muted-foreground">{session.roles.map(roleLabel).join("، ") || "بدون نقش"}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
