import type { ReactNode } from "react";
import { AlertCircle, FileText, type LucideIcon } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-full bg-skeleton", className)} aria-hidden />;
}

// Rows match the real table row height so nothing jumps when data lands.
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  const widths = ["w-16", "w-32", "w-24", "w-20", "w-28", "w-14"];
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-14 items-center gap-6 border-b border-border px-6 last:border-0">
          {Array.from({ length: columns }, (_col, c) => (
            <Skeleton
              key={c}
              className={cn("h-3.5", c === columns - 1 ? "ml-auto h-6 w-16" : widths[(r + c) % widths.length])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// First use: icon tile, title, one-line explanation, one action.
export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="flex size-14 items-center justify-center rounded-card bg-navy-50 text-navy-700">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-card font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-body text-slate">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function NoResults({ query, hint, onClear }: { query?: string; hint?: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <h3 className="text-card font-semibold text-ink">
        {query ? `No results match “${query}”` : "Nothing matches these filters"}
      </h3>
      <p className="mt-1.5 text-body text-slate">{hint ?? "Try a different search, or clear the filters."}</p>
      {onClear && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function ErrorBanner({
  title,
  message,
  onRetry,
  extra,
  className,
}: {
  title: string;
  message?: ReactNode;
  onRetry?: () => void;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex gap-3 rounded-card border border-danger-100 bg-danger-50 p-4", className)}>
      <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-danger" />
      <div className="min-w-0">
        <p className="font-semibold text-[#7f1414]">{title}</p>
        {message && <p className="mt-0.5 text-helper text-[#7f1414]/90">{message}</p>}
        {(onRetry || extra) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" variant="danger" onClick={onRetry}>
                Try again
              </Button>
            )}
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}
