import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Fuel level (E ¼ ½ ¾ F), range toggle (Today / 7 days / 30 days): selected = navy fill.
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-input border border-border bg-surface p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            // flex-auto (not flex-1): each option is at least as wide as its label, so labels never get cut off.
            "h-8 min-w-12 flex-auto whitespace-nowrap rounded-[5px] px-3 text-body font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-600/40",
            value === o.value ? "bg-navy-900 text-white" : "text-slate hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Selectable pill (service types, POS categories).
export function Chip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-body font-medium transition-colors",
        selected ? "border-navy-700 bg-navy-700 text-white" : "border-border bg-surface text-ink hover:bg-navy-50",
      )}
    >
      {children}
    </button>
  );
}

export function PageHeader({
  title,
  breadcrumb,
  badge,
  description,
  actions,
}: {
  title: string;
  breadcrumb?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-helper text-slate">{breadcrumb}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-body text-slate">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-helper text-slate">{i.label}</dt>
          <dd className="mt-0.5 break-words text-body text-ink">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
