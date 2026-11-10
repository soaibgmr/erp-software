import type { Paginated } from "../../../common/pagination";
import type { ListShiftsQuery, ShiftRow } from "../shift.types";

export interface IShiftRepository {
  findOpen(branchId: string, userId: string): Promise<ShiftRow | null>;
  findById(id: string): Promise<ShiftRow | null>;
  create(data: { branchId: string; userId: string; counter: string; openingCash: string }): Promise<ShiftRow>;
  // OPEN → CLOSED; false when it was already closed.
  close(
    id: string,
    data: { counted: Record<string, string>; expected: Record<string, string>; note: string | null },
  ): Promise<boolean>;
  // Net payments per method taken in the shift, in paise.
  paymentTotals(shiftId: string): Promise<{ mode: string; amountPaise: number }[]>;
  invoiceStats(
    shiftId: string,
  ): Promise<{ count: number; totalPaise: number; cancelledCount: number; creditPaise: number }>;
  list(branchId: string, query: ListShiftsQuery): Promise<Paginated<ShiftRow>>;
}
