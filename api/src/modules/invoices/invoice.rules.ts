import { divRound } from "@erp-software/shared";
import type { CreditableLine, StoredInvoiceStatus } from "./invoice.types";

// Status from the money (paise). Balance due = grand total − credit notes − net payments.
export function deriveStatus(grandPaise: number, creditedPaise: number, paidPaise: number): StoredInvoiceStatus {
  const due = grandPaise - creditedPaise - paidPaise;
  if (due <= 0) return "PAID";
  return paidPaise > 0 ? "PARTIALLY_PAID" : "UNPAID";
}

export const balanceDue = (inv: { grandTotal: number; creditedTotal: number; paidTotal: number }) =>
  inv.grandTotal - inv.creditedTotal - inv.paidTotal;

export interface CreditAmounts {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

// Amounts credited when `quantityMilli` of an invoice line is returned: proportional to the
// quantity, and for the last units exactly what is left, so a full return credits the line to the paisa.
export function creditLineAmounts(line: CreditableLine, quantityMilli: number): CreditAmounts {
  const remaining = line.quantity - line.returned;
  const part = (whole: number, credited: number) =>
    quantityMilli >= remaining ? whole - credited : divRound(whole * quantityMilli, line.quantity);
  const taxablePaise = part(line.taxablePaise, line.credited.taxablePaise);
  const cgstPaise = part(line.cgstPaise, line.credited.cgstPaise);
  const sgstPaise = part(line.sgstPaise, line.credited.sgstPaise);
  const igstPaise = part(line.igstPaise, line.credited.igstPaise);
  return {
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: taxablePaise + cgstPaise + sgstPaise + igstPaise,
  };
}

// Like invoices, credit note totals are rounded to the rupee with a visible round-off.
export function roundToRupee(paise: number): { totalPaise: number; roundOffPaise: number } {
  const totalPaise = divRound(paise, 100) * 100;
  return { totalPaise, roundOffPaise: totalPaise - paise };
}
