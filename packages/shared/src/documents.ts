// Document number series: INV-26-01874 = prefix, financial-year code, zero-padded sequence.

export const DOCUMENT_TYPES = [
  "INVOICE",
  "CREDIT_NOTE",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "OPENING_BALANCE",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_DEFAULTS: Record<DocumentType, { label: string; prefix: string; padding: number }> = {
  INVOICE: { label: "Tax invoice", prefix: "INV", padding: 5 },
  CREDIT_NOTE: { label: "Credit note", prefix: "CN", padding: 5 },
  STOCK_ADJUSTMENT: { label: "Stock adjustment", prefix: "ADJ", padding: 5 },
  STOCK_TRANSFER: { label: "Stock transfer", prefix: "STR", padding: 5 },
  OPENING_BALANCE: { label: "Old dues (opening balance)", prefix: "OB", padding: 5 },
};

// Indian financial year runs April–March. Returns the starting calendar year,
// evaluated in the app timezone so 31 March 23:30 IST stays in the old year.
export function financialYearStart(date: Date, timeZone = "Asia/Kolkata"): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  return month >= 4 ? year : year - 1;
}

// 2026 -> "2026-27"
export const financialYearLabel = (startYear: number) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

export function formatDocumentNumber(prefix: string, fyStartYear: number, sequence: number, padding: number): string {
  const fy = String(fyStartYear % 100).padStart(2, "0");
  return `${prefix}-${fy}-${String(sequence).padStart(padding, "0")}`;
}
