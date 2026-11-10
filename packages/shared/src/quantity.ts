// Quantities are Decimal(12,3) in the database (1.5 L of oil, 0.25 m of hose).
// Calculations run on integer thousandths ("milli-units") so sums never drift.

export type Milli = number;

export function toMilli(quantity: number | string): Milli {
  const n = typeof quantity === "string" ? Number(quantity) : quantity;
  if (!Number.isFinite(n)) throw new TypeError(`Not a valid quantity: ${quantity}`);
  return Math.round(n * 1000);
}

export const fromMilli = (milli: Milli): number => milli / 1000;

// Fixed 3-decimal string for Prisma Decimal columns: 1500 -> "1.500".
export const milliToDecimal = (milli: Milli): string => (milli / 1000).toFixed(3);

const qtyFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

// "12", "1.5", "-2.25"; whole numbers drop the decimals.
export const formatQty = (quantity: number | string): string => qtyFormat.format(Number(quantity));

export type StockStatus = "IN_STOCK" | "LOW" | "OUT";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LOW: "Low stock",
  OUT: "Out of stock",
};

// Available = on hand − reserved. Out when nothing is available; low when at or below the minimum level.
export function stockStatus(available: number | string, minLevel: number | string): StockStatus {
  const a = toMilli(available);
  const min = toMilli(minLevel);
  if (a <= 0) return "OUT";
  if (min > 0 && a <= min) return "LOW";
  return "IN_STOCK";
}
