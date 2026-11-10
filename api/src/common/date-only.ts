// Calendar days without a time ("2026-11-10"), as used by @db.Date columns and report periods.
export type DateOnly = string;

// @db.Date columns come back as midnight UTC.
export const toDateOnly = (d: Date | null): DateOnly | null => (d ? d.toISOString().slice(0, 10) : null);
export const fromDateOnly = (d: DateOnly | null | undefined): Date | null =>
  d ? new Date(`${d}T00:00:00.000Z`) : null;

// Today's date in the app timezone, as YYYY-MM-DD.
export const todayIn = (timeZone: string, now = new Date()): DateOnly =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const DAY_MS = 86_400_000;

export const addDays = (d: DateOnly, days: number): DateOnly =>
  new Date(Date.parse(`${d}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// Whole days from `from` to `to` (negative when `to` is earlier).
export const daysBetween = (from: DateOnly, to: DateOnly): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
