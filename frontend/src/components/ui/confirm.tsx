import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Promise-based confirm dialog — replaces window.confirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && close(false)}>
        {options && (
          <DialogContent
            size="sm"
            title={
              <span className="flex items-center gap-2">
                {options.destructive && <AlertTriangle className="size-5 text-danger" aria-hidden />}
                {options.title}
              </span>
            }
            description={options.description}
            footer={
              <>
                <Button variant="ghost" onClick={() => close(false)}>
                  {options.cancelLabel ?? "انصراف"}
                </Button>
                <Button variant={options.destructive ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
                  {options.confirmLabel ?? "تأیید"}
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
