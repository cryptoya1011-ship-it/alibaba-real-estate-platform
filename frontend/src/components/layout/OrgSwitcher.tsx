import { useState } from "react";
import { Building, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Code } from "@/components/ui/misc";
import { errorMessage } from "@/components/ui/states";
import { CreateOrgForm } from "@/features/auth/CreateOrgForm";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

export function OrgList({ onSelected }: { onSelected?: () => void }) {
  const { session, selectOrganization } = useSession();
  const [pending, setPending] = useState<number | null>(null);
  if (!session) return null;
  return (
    <ul className="flex flex-col gap-2">
      {session.organizations.map((org) => {
        const active = org.id === session.organization_id;
        return (
          <li key={org.id}>
            <button
              type="button"
              disabled={pending !== null}
              onClick={async () => {
                if (active) {
                  onSelected?.();
                  return;
                }
                setPending(org.id);
                try {
                  await selectOrganization(org.id);
                  toast.success(`سازمان «${org.name}» فعال شد`);
                  onSelected?.();
                } catch (err) {
                  toast.error(errorMessage(err, "خطا در انتخاب سازمان"));
                } finally {
                  setPending(null);
                }
              }}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-start transition hairline",
                active ? "border-primary/50 bg-primary-soft" : "bg-card-2 hover:bg-muted",
              )}
            >
              <span className={cn("grid size-10 place-items-center rounded-[12px]", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Building className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{org.name}</span>
                <Code>{org.slug}</Code>
              </span>
              {org.is_owner && <Badge tone="accent">مالک</Badge>}
              {pending === org.id ? (
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              ) : active ? (
                <Check className="size-5 text-primary" aria-label="فعال" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function OrgSwitcher({ compact = false }: { compact?: boolean }) {
  const { currentOrg } = useSession();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCreating(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="تغییر سازمان"
        className={cn(
          "flex min-h-10 min-w-0 items-center gap-2 rounded-[12px] bg-card-2 px-2.5 py-1 text-start transition hairline hover:bg-muted",
          compact ? "max-w-[46vw]" : "w-full",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-primary-soft text-primary">
          <Building className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-caption font-semibold">{currentOrg?.name ?? "انتخاب سازمان"}</span>
          {currentOrg && <Code className="truncate text-[10.5px]">{currentOrg.slug}</Code>}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <DialogContent
        title={creating ? "سازمان جدید" : "سازمان‌های شما"}
        description={creating ? "سازمان جدید ساخته و بلافاصله فعال می‌شود" : "داده‌های هر سازمان کاملاً جداست"}
        footer={
          !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong text-body font-medium text-primary transition hover:bg-primary-soft sm:flex-1"
            >
              <Plus className="size-4" aria-hidden />
              ساخت سازمان جدید
            </button>
          )
        }
      >
        {creating ? <CreateOrgForm onDone={() => setOpen(false)} /> : <OrgList onSelected={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
