import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-[12px] border border-input bg-card-2 px-3.5 text-body text-foreground placeholder:text-muted-foreground/70 " +
  "transition-[border-color,box-shadow] duration-150 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 " +
  "disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { ltr?: boolean }>(
  function Input({ className, ltr, ...props }, ref) {
    return (
      <input
        ref={ref}
        dir={ltr ? "ltr" : undefined}
        className={cn(fieldBase, "h-11", ltr && "text-left font-mono text-caption tracking-wide", className)}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "min-h-24 resize-y py-2.5 leading-7", className)} {...props} />;
  },
);

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-caption font-medium text-muted-foreground", className)} {...props} />;
}

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  required?: boolean;
};

/** Label + control + hint/error, with correct aria wiring. */
export function Field({ label, hint, error, className, children, required }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="ms-0.5 text-danger">*</span>}
        </Label>
      )}
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
