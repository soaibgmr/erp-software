import { divRound, fromPaise, toPaise, type Paise } from "./money.js";

// GST engine shared by the POS preview (UI) and invoice posting (API), so both always agree.
// Strategy per supply type: intra-state splits tax into CGST + SGST, inter-state charges IGST.

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export type SupplyType = "INTRA_STATE" | "INTER_STATE";

export interface GstLineInput {
  quantity: number; // up to 3 decimals (e.g. 1.5 L)
  rate: number; // unit price in rupees
  gstRate: number; // percent, e.g. 18
  discount?: number; // line discount in rupees
  taxInclusive?: boolean; // rate already includes GST (e.g. MRP items)
}

export interface GstLineResult {
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  totalPaise: Paise;
}

export interface GstRateSummary {
  gstRate: number;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
}

export interface GstTotals {
  lines: GstLineResult[];
  byRate: GstRateSummary[];
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  taxPaise: Paise;
  grossPaise: Paise; // taxable + tax, before rounding
  roundOffPaise: Paise; // signed, brings gross to the nearest rupee
  totalPaise: Paise;
}

// Intra-state when the place of supply is the supplier's state (B2C counter sales are always local).
export function supplyTypeFor(supplierStateCode: string, placeOfSupplyStateCode?: string | null): SupplyType {
  return !placeOfSupplyStateCode || placeOfSupplyStateCode === supplierStateCode ? "INTRA_STATE" : "INTER_STATE";
}

// Rates are percents with up to 2 decimals; work in basis points to stay in integers.
const basisPoints = (percent: number) => Math.round(percent * 100);

export function calculateLine(line: GstLineInput, supplyType: SupplyType): GstLineResult {
  const qtyMilli = Math.round(line.quantity * 1000);
  const grossPaise = divRound(qtyMilli * toPaise(line.rate), 1000) - toPaise(line.discount ?? 0);
  const bp = basisPoints(line.gstRate);

  const taxablePaise = line.taxInclusive ? divRound(grossPaise * 10_000, 10_000 + bp) : grossPaise;

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (supplyType === "INTRA_STATE") {
    // Each half is rounded separately, as printed on the invoice.
    cgstPaise = divRound(taxablePaise * bp, 20_000);
    sgstPaise = cgstPaise;
  } else {
    igstPaise = divRound(taxablePaise * bp, 10_000);
  }

  return {
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: taxablePaise + cgstPaise + sgstPaise + igstPaise,
  };
}

export function calculateGst(lines: GstLineInput[], supplyType: SupplyType): GstTotals {
  const results = lines.map((l) => calculateLine(l, supplyType));

  const byRateMap = new Map<number, GstRateSummary>();
  results.forEach((r, i) => {
    const gstRate = lines[i]!.gstRate;
    const s = byRateMap.get(gstRate) ?? { gstRate, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    s.taxablePaise += r.taxablePaise;
    s.cgstPaise += r.cgstPaise;
    s.sgstPaise += r.sgstPaise;
    s.igstPaise += r.igstPaise;
    byRateMap.set(gstRate, s);
  });

  const sum = (key: keyof GstLineResult) => results.reduce((acc, r) => acc + r[key], 0);
  const taxablePaise = sum("taxablePaise");
  const cgstPaise = sum("cgstPaise");
  const sgstPaise = sum("sgstPaise");
  const igstPaise = sum("igstPaise");
  const taxPaise = cgstPaise + sgstPaise + igstPaise;
  const grossPaise = taxablePaise + taxPaise;
  const totalPaise = divRound(grossPaise, 100) * 100;

  return {
    lines: results,
    byRate: [...byRateMap.values()].sort((a, b) => a.gstRate - b.gstRate),
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxPaise,
    grossPaise,
    roundOffPaise: totalPaise - grossPaise,
    totalPaise,
  };
}

export { fromPaise };
