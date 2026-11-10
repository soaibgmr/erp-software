export interface IDashboardRepository {
  // Non-cancelled invoices dated in [start, end).
  salesTotals(branchIds: string[], start: Date, end: Date): Promise<{ total: string; bills: number }>;
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
