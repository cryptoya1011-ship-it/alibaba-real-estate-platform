import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CloudUpload, LogOut, Moon, Plus, Search, Sun } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { useOutbox } from "@/hooks/useOutbox";
import { visibleNav } from "@/lib/nav";

const itemCls =
  "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-[10px] px-3 text-body outline-none data-[selected=true]:bg-muted [&_svg]:size-[18px] [&_svg]:text-muted-foreground";
const groupCls = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground";

/** ⌘K / Ctrl+K palette — navigation + quick actions. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { session, logout } = useSession();
  const { theme, toggle } = useTheme();
  const { count, sync } = useOutbox();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    setSearch("");
    fn();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[18px] bg-popover shadow-lg hairline data-[state=open]:animate-fade-in">
          <DialogPrimitive.Title className="sr-only">جستجو و فرمان‌ها</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">بخش یا فرمان مورد نظر را جستجو کنید</DialogPrimitive.Description>
          <Command label="جستجو و فرمان‌ها" loop>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-5 text-muted-foreground" aria-hidden />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="جستجوی بخش یا فرمان…"
                className="h-14 flex-1 bg-transparent text-title outline-none placeholder:text-muted-foreground/70"
              />
              <kbd dir="ltr" className="hidden rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">Esc</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-body text-muted-foreground">نتیجه‌ای پیدا نشد</Command.Empty>
              <Command.Group heading="اقدام سریع" className={groupCls}>
                <Command.Item className={itemCls} onSelect={() => run(() => navigate("/app/properties?new=1"))}>
                  <Plus aria-hidden /> ثبت ملک جدید
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => navigate("/app/crm?new=1"))}>
                  <Plus aria-hidden /> مشتری جدید
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => navigate("/app/visits?new=1"))}>
                  <Plus aria-hidden /> بازدید جدید
                </Command.Item>
                <Command.Item className={itemCls} onSelect={() => run(() => navigate("/app/deals?new=1"))}>
                  <Plus aria-hidden /> معامله جدید
                </Command.Item>
              </Command.Group>
              <Command.Group heading="بخش‌ها" className={groupCls}>
                {visibleNav(!!session?.user.is_super_admin).map((item) => (
                  <Command.Item key={item.key} value={`${item.label} ${item.key}`} className={itemCls} onSelect={() => run(() => navigate(item.to))}>
                    <item.icon aria-hidden /> {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="تنظیمات" className={groupCls}>
                <Command.Item className={itemCls} onSelect={() => run(toggle)}>
                  {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
                  {theme === "dark" ? "حالت روشن" : "حالت تیره"}
                </Command.Item>
                {count > 0 && (
                  <Command.Item className={itemCls} onSelect={() => run(() => void sync())}>
                    <CloudUpload aria-hidden /> همگام‌سازی صف آفلاین
                  </Command.Item>
                )}
                <Command.Item className={itemCls} onSelect={() => run(logout)}>
                  <LogOut aria-hidden /> خروج از حساب
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
