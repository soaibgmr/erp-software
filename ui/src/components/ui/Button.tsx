import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Primary = navy (saves). Accent = yellow, only for the single money action on a screen.
// Outline = secondary. Ghost = cancel. Danger = destructive confirm.
export type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy-700 text-white hover:bg-navy-800 disabled:bg-border disabled:text-muted",
  accent: "bg-yellow-500 text-navy-900 hover:bg-yellow-400 disabled:bg-border disabled:text-muted",
  outline: "border border-border bg-surface text-navy-700 hover:bg-navy-50 disabled:text-muted",
  ghost: "text-navy-700 hover:bg-navy-50 disabled:text-muted",
  danger: "bg-danger text-white hover:bg-[#9b1717] disabled:bg-border disabled:text-muted",
  "danger-outline": "border border-danger-100 bg-surface text-danger hover:bg-danger-50 disabled:text-muted",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-helper gap-1.5",
  md: "h-10 px-4 text-body gap-2",
  lg: "h-12 px-6 text-card gap-2",
};

// The button look for things that aren't <button>s, e.g. a react-router <Link> styled as a button.
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-input font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    loadingText,
    icon,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-input border border-border bg-surface text-navy-700 hover:bg-navy-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
