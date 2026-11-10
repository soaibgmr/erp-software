import { toCsv, type ReportCell, type ReportColumn, type ReportResult } from "@erp-software/shared";
import { buildXlsx, type XlsxCell } from "../../common/xlsx";

// Turns a report result into a downloadable CSV or Excel file. Tables follow each other in the
// CSV (separated by a blank line and their title); in Excel each table gets its own sheet.

const NUMERIC = new Set(["money", "qty", "int", "percent"]);

const cellFor = (col: ReportColumn, v: ReportCell): XlsxCell => {
  if (v === null || v === undefined) return null;
  if (NUMERIC.has(col.type)) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  if (col.type === "date" && typeof v === "string") return v.slice(0, 10);
  if (col.type === "datetime" && typeof v === "string") return v.replace("T", " ").slice(0, 19);
  return v;
};

const header = (r: ReportResult) => {
  const period = r.from ? `${r.from} to ${r.to}` : `As of ${r.asOf}`;
  return `${r.title} · ${r.scope.label} · ${period}`;
};

export function reportToCsv(r: ReportResult): string {
  const out: XlsxCell[][] = [[header(r)]];
  for (const t of r.tables) {
    out.push([]);
    if (t.title) out.push([t.title]);
    out.push(t.columns.map((c) => c.label));
    for (const row of t.rows) out.push(t.columns.map((c) => cellFor(c, row[c.key] ?? null)));
    if (t.totals)
      out.push(
        t.columns.map((c, i) => (i === 0 && t.totals![c.key] == null ? "Total" : cellFor(c, t.totals![c.key] ?? null))),
      );
  }
  for (const n of r.notes) out.push([], [n]);
  // BOM so Excel opens UTF-8 (₹, names) correctly.
  return "﻿" + toCsv(out);
}

export function reportToXlsx(r: ReportResult): Buffer {
  return buildXlsx(
    r.tables.map((t) => ({
      name: t.title ?? r.title,
      widths: t.columns.map((c) => (c.type === "text" ? 28 : c.type === "datetime" ? 18 : 14)),
      rows: [
        t.columns.map((c) => c.label),
        ...t.rows.map((row) => t.columns.map((c) => cellFor(c, row[c.key] ?? null))),
        ...(t.totals
          ? [
              t.columns.map((c, i) =>
                i === 0 && t.totals![c.key] == null ? "Total" : cellFor(c, t.totals![c.key] ?? null),
              ),
            ]
          : []),
      ],
    })),
  );
}

export const reportFileName = (r: ReportResult, ext: string) =>
  `${r.name}_${(r.from ?? r.asOf).replace(/-/g, "")}${r.to && r.to !== r.from ? `-${r.to.replace(/-/g, "")}` : ""}.${ext}`;
