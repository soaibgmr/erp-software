import {
  formatINR,
  formatQty,
  type ReportCell,
  type ReportColumn,
  type ReportTable as Table,
} from "@erp-software/shared";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const NUMERIC = new Set(["money", "qty", "int", "percent"]);

// "2026-11-20" → "20 Nov 2026" without a timezone shift.
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export function formatCell(col: ReportColumn, v: ReportCell): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (col.type) {
    case "money":
      return formatINR(v, { exact: true });
    case "qty":
      return formatQty(v);
    case "percent":
      return `${Number(v)}%`;
    case "int":
      return String(v);
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
        ? dayFmt.format(new Date(`${v}T00:00:00Z`))
        : formatDate(String(v));
    case "datetime":
      return formatDateTime(String(v));
    default:
      return String(v);
  }
}

const STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Part paid",
  UNPAID: "Unpaid",
  CANCELLED: "Cancelled",
};

export function ReportTableView({ table }: { table: Table }) {
  const display = (col: ReportColumn, v: ReportCell) =>
    col.key === "status" && typeof v === "string" ? (STATUS_LABELS[v] ?? v) : formatCell(col, v);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border bg-navy-50">
            {table.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "eyebrow h-10 whitespace-nowrap px-4 font-semibold text-slate",
                  NUMERIC.has(c.type) ? "text-right" : "text-left",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className={cn("border-b border-border", row.status === "CANCELLED" && "text-muted")}>
              {table.columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-2.5",
                    NUMERIC.has(c.type) ? "text-right tabular whitespace-nowrap" : "",
                    c.type === "datetime" || c.type === "date" ? "whitespace-nowrap" : "",
                    c.type === "money" && Number(row[c.key]) < 0 && "text-danger",
                  )}
                >
                  {display(c, row[c.key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.totals && (
          <tfoot>
            <tr className="bg-navy-50 font-semibold">
              {table.columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn("px-4 py-3", NUMERIC.has(c.type) ? "text-right tabular whitespace-nowrap" : "")}
                >
                  {i === 0 && table.totals![c.key] == null
                    ? "Total"
                    : table.totals![c.key] == null
                      ? ""
                      : formatCell(c, table.totals![c.key]!)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
