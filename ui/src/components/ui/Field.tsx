import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

// Label above the field (6px gap). Helper text below; an error replaces it, in the same slot, so layout never shifts.
interface FieldProps {
  label: string;
  required?: boolean;
  helper?: ReactNode;
  error?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

export function Field({ label, required, helper, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": helper || error ? hintId : undefined,
      })}
      {(error || helper) && (
        <p id={hintId} className={cn("text-helper", error ? "text-danger" : "text-slate")}>
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

const control =
  "h-10 w-full rounded-input border bg-surface px-3 text-body text-ink placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-navy-600/25 focus:border-navy-600 disabled:bg-canvas disabled:text-slate aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode; align?: "left" | "right" }
>(function Input({ className, suffix, align = "left", ...props }, ref) {
  const input = (
    <input
      ref={ref}
      className={cn(
        control,
        "border-border",
        align === "right" && "text-right tabular",
        suffix && "rounded-r-none",
        className,
      )}
      {...props}
    />
  );
  if (!suffix) return input;
  return (
    <div className="flex">
      {input}
      <span className="inline-flex items-center rounded-r-input border border-l-0 border-border bg-canvas px-3 text-helper text-slate">
        {suffix}
      </span>
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(control, "border-border pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea ref={ref} rows={rows} className={cn(control, "h-auto border-border py-2.5", className)} {...props} />
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }
>(function Checkbox({ label, description, className, ...props }, ref) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 text-body",
        props.disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded accent-navy-700" {...props} />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="block text-helper text-slate">{description}</span>}
      </span>
    </label>
  );
});

// Two columns on desktop, one below 640px; 16px between rows.
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>{children}</div>;
}
