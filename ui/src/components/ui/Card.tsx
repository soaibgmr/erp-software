import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Cards: 1px border, no shadow, 10px radius.
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-card border border-border bg-surface", className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4", className)}
    >
      <div className="min-w-0">
        <h2 className="text-card font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-helper text-slate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function KpiCard({
  label,
  value,
  sub,
  badge,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body text-slate">{label}</p>
        {badge}
      </div>
      <p className="mt-2 text-kpi font-bold text-ink tabular">{value}</p>
      {sub && <p className="mt-1.5 text-helper text-slate">{sub}</p>}
    </Card>
  );
}
