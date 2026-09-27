import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string; hint?: string };

type SelectProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/** Accessible Radix select, RTL-aware, styled via tokens. Empty string = no selection. */
export function Select({ value, onValueChange, options, placeholder = "انتخاب کنید", id, className, disabled, invalid, ...aria }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled} dir="rtl">
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-[12px] border border-input bg-card-2 px-3.5 text-body outline-none transition",
          "focus:border-primary focus:ring-4 focus:ring-primary/15 data-[placeholder]:text-muted-foreground/80 disabled:opacity-60",
          "aria-[invalid=true]:border-danger",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[14px] bg-popover shadow-lg hairline data-[state=open]:animate-fade-in"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-[10px] py-2 pe-3 ps-8 text-body outline-none data-[highlighted]:bg-muted data-[state=checked]:font-semibold data-[state=checked]:text-primary"
              >
                <SelectPrimitive.ItemIndicator className="absolute start-2.5">
                  <Check className="size-4" aria-hidden />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.hint && <span className="ms-auto text-caption text-muted-foreground">{o.hint}</span>}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
