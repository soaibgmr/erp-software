// Money is handled as integer paise in calculations so sums never drift.
// The API stores Decimal(12,2) and sends amounts as strings or numbers; convert at the edges.

export type Paise = number;

export function toPaise(amount: number | string): Paise {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new TypeError(`Not a valid amount: ${amount}`);
  return Math.round(n * 100);
}

export const fromPaise = (paise: Paise): number => paise / 100;

// Integer division rounding half away from zero (ROUND_HALF_UP for positive values).
export function divRound(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  return sign * Math.floor((2 * n + d) / (2 * d));
}

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// formatINR(248560) -> "₹2,48,560"; formatINR(4814, { exact: true }) -> "₹4,814.00".
export function formatINR(amount: number | string, { exact = false } = {}): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return (exact ? inrExact : inrWhole).format(n);
}

const plain = new Intl.NumberFormat("en-IN");
export const formatNumber = (n: number) => plain.format(n);
