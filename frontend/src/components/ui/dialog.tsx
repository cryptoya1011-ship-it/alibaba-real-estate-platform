import { useRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type ContentProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** "responsive" = bottom-sheet on mobile, centered modal on ≥640px. "sheet" = always bottom sheet. */
  variant?: "responsive" | "sheet" | "side";
  size?: "sm" | "md" | "lg";
  className?: string;
  hideClose?: boolean;
};

export function DialogContent({
  title,
  description,
  children,
  footer,
  variant = "responsive",
  size = "md",
  className,
  hideClose,
}: ContentProps) {
  const sizes = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[3px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        ref={contentRef}
        // Focus the sheet itself (not the close button / first input) so mobile keyboards stay closed
        // and no stray focus ring shows; Tab still moves into the dialog, focus stays trapped.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col bg-popover text-foreground shadow-lg outline-none hairline",
          variant === "side"
            ? "inset-y-0 start-0 w-[88vw] max-w-sm rounded-e-[20px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out"
            : "inset-x-0 bottom-0 rounded-t-[20px] pb-safe data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down",
          variant === "responsive" &&
            cn(
              "sm:inset-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[calc(100vw-2rem)] sm:rounded-[20px] sm:pb-0",
              "sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out",
              sizes[size],
            ),
          variant === "sheet" && "sm:mx-auto sm:max-w-lg",
          className,
        )}
      >
        {variant !== "side" && (
          <div aria-hidden className={cn("mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border-strong", variant === "responsive" && "sm:hidden")} />
        )}
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogPrimitive.Title className="text-title-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-body text-muted-foreground">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "پنجره"}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close
              aria-label="بستن"
              className="-me-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-start">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
