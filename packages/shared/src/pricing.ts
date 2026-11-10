import { calculateGst, type GstLineResult, type GstRateSummary, type SupplyType } from "./gst.js";
import { divRound, toPaise, type Paise } from "./money.js";

// Cart pricing shared by the POS preview (UI) and invoice posting (API).
// Order of operations (PRD §5): gross = qty × rate → line discount → bill discount apportioned
// to lines by their net amount → GST per line → totals rounded to the rupee.

export interface CartLineInput {
  quantity: number; // up to 3 decimals
  rate: number; // unit price in rupees (incl. GST when taxInclusive)
  gstRate: number;
  taxInclusive?: boolean;
  discount?: number; // line discount in rupees
}

export type BillDiscountType = "AMOUNT" | "PERCENT";
export interface BillDiscount {
  type: BillDiscountType;
  value: number; // rupees, or percent (up to 2 decimals)
}

export interface PricedLine extends GstLineResult {
  grossPaise: Paise; // qty × rate
  lineDiscountPaise: Paise;
  billDiscountPaise: Paise; // this line's share of the bill discount
}

export interface PricedCart {
  lines: PricedLine[];
  byRate: GstRateSummary[];
  grossPaise: Paise; // Σ qty × rate, before any discount
  lineDiscountPaise: Paise;
  billDiscountPaise: Paise;
  discountPaise: Paise;
  // Discount as a share of the gross, in basis points (525 = 5.25 %), for the role limit.
  discountBasisPoints: number;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  taxPaise: Paise;
  roundOffPaise: Paise;
  totalPaise: Paise;
  // Problems the caller must surface (discount larger than the amount, …); prices are still computed.
  issues: { line?: number; message: string }[];
}

export function priceCart(
  lines: CartLineInput[],
  billDiscount: BillDiscount | null | undefined,
  supplyType: SupplyType,
): PricedCart {
  const issues: PricedCart["issues"] = [];

  const gross = lines.map((l) => divRound(Math.round(l.quantity * 1000) * toPaise(l.rate), 1000));
  const lineDiscount = lines.map((l, i) => {
    const d = toPaise(l.discount ?? 0);
    if (d < 0) issues.push({ line: i, message: "Discount can't be negative" });
    if (d > gross[i]!) issues.push({ line: i, message: "Discount is more than the line amount" });
    return Math.min(Math.max(d, 0), gross[i]!);
  });
  const net = gross.map((g, i) => g - lineDiscount[i]!);
  const netTotal = net.reduce((a, b) => a + b, 0);

  let billPaise = 0;
  if (billDiscount && billDiscount.value > 0) {
    billPaise =
      billDiscount.type === "PERCENT"
        ? divRound(netTotal * Math.round(billDiscount.value * 100), 10_000)
        : toPaise(billDiscount.value);
    if (billDiscount.type === "PERCENT" && billDiscount.value > 100)
      issues.push({ message: "Discount can't be more than 100%" });
    if (billPaise > netTotal) {
      issues.push({ message: "Bill discount is more than the bill" });
      billPaise = netTotal;
    }
  }
  const share = apportion(billPaise, net);

  const totals = calculateGst(
    lines.map((l, i) => ({
      quantity: l.quantity,
      rate: l.rate,
      gstRate: l.gstRate,
      taxInclusive: l.taxInclusive,
      discount: (lineDiscount[i]! + share[i]!) / 100,
    })),
    supplyType,
  );

  const grossPaise = gross.reduce((a, b) => a + b, 0);
  const lineDiscountPaise = lineDiscount.reduce((a, b) => a + b, 0);
  const discountPaise = lineDiscountPaise + billPaise;
  return {
    lines: totals.lines.map((r, i) => ({
      ...r,
      grossPaise: gross[i]!,
      lineDiscountPaise: lineDiscount[i]!,
      billDiscountPaise: share[i]!,
    })),
    byRate: totals.byRate,
    grossPaise,
    lineDiscountPaise,
    billDiscountPaise: billPaise,
    discountPaise,
    discountBasisPoints: grossPaise > 0 ? divRound(discountPaise * 10_000, grossPaise) : 0,
    taxablePaise: totals.taxablePaise,
    cgstPaise: totals.cgstPaise,
    sgstPaise: totals.sgstPaise,
    igstPaise: totals.igstPaise,
    taxPaise: totals.taxPaise,
    roundOffPaise: totals.roundOffPaise,
    totalPaise: totals.totalPaise,
    issues,
  };
}

// Splits `amount` across lines in proportion to `weights` (largest remainder), so shares sum exactly.
export function apportion(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const shares = raw.map(Math.floor);
  let left = amount - shares.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i]!++;
    left--;
  }
  return shares;
}

// Split payment: what is still due after the entered payments (never negative), and the cash change.
export function paymentSummary(
  totalPaise: Paise,
  payments: { mode: string; amount: number; tendered?: number | null }[],
) {
  const paidPaise = payments.reduce((s, p) => s + toPaise(p.amount), 0);
  const changePaise = payments
    .filter((p) => p.mode === "CASH" && p.tendered != null)
    .reduce((s, p) => s + Math.max(toPaise(p.tendered!) - toPaise(p.amount), 0), 0);
  return {
    paidPaise,
    duePaise: Math.max(totalPaise - paidPaise, 0),
    overPaise: Math.max(paidPaise - totalPaise, 0),
    changePaise,
  };
}
