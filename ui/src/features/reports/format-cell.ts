import { formatINR, formatQty, type ReportCell, type ReportColumn } from "@erp-software/shared";
import { formatDate, formatDateTime } from "@/lib/utils";

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
