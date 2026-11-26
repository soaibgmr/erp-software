// Sums as numeric text: GST on sale invoices, and on credit notes (return*) in the same period.
export interface GstTotalsRow {
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  returnTaxable: string;
  returnCgst: string;
  returnSgst: string;
  returnIgst: string;
}

export interface IDashboardRepository {
  // Non-cancelled invoices dated in [start, end).
  salesTotals(branchIds: string[], start: Date, end: Date): Promise<{ total: string; bills: number }>;
  // GST on non-cancelled sale invoices dated in [start, end) and on credit notes raised in [start, end).
  gstTotals(branchIds: string[], start: Date, end: Date): Promise<GstTotalsRow>;
  // Net payments (receipts − refunds − reversals) received in [start, end), per mode.
  collections(branchIds: string[], start: Date, end: Date): Promise<{ mode: string; amount: string }[]>;
  // Line totals per local day, split into parts (ITEM) and labour; days without sales are absent.
  salesTrend(
    branchIds: string[],
    start: Date,
    end: Date,
    timeZone: string,
  ): Promise<{ day: string; bills: number; parts: string; labour: string }[]>;
}
