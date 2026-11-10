import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/lib/api-client";
import { cn, errorMessage } from "@/lib/utils";
import { ErrorBanner, TableSkeleton } from "./States";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

// One table for every list: renders the designed loading, error and empty states itself.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (error && !rows) {
    return (
      <div className="p-5">
        <ErrorBanner title="Couldn't load this list" message={errorMessage(error)} onRetry={onRetry} />
      </div>
    );
  }
  if (loading && !rows) return <TableSkeleton columns={Math.min(columns.length, 5)} />;
  if (!rows?.length) return <>{empty}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "eyebrow h-11 px-6 font-semibold whitespace-nowrap text-slate",
                  c.align === "right" ? "text-right" : "text-left",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick && (() => onRowClick(row))}
              className={cn("border-b border-border last:border-0", onRowClick && "cursor-pointer hover:bg-navy-50")}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn("h-14 px-6 py-2", c.align === "right" && "text-right tabular", c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta: PaginationMeta | undefined; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const btn =
    "inline-flex size-8 items-center justify-center rounded-input border border-border text-navy-700 hover:bg-navy-50 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-3 text-helper text-slate">
      <span className="tabular">
        {from}–{to} of {meta.total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={btn}
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          className={btn}
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
