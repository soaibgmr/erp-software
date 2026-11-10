import type { PaymentMethod, ShiftClose, ShiftOpen } from "@automobile/shared";

export type OpenShiftDto = ShiftOpen;
export type CloseShiftDto = ShiftClose;

export interface ShiftDto {
  id: string;
  branchId: string;
  user: { id: string; name: string } | null;
  counter: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  openedAt: Date;
  closedAt: Date | null;
  closeNote: string | null;
}

export interface ShiftMethodLine {
  mode: PaymentMethod;
  // Expected = payments taken in the shift (net of reversals and refunds), plus opening cash for CASH.
  expected: string;
  counted: string | null;
  variance: string | null;
}

export interface ShiftReportDto extends ShiftDto {
  methods: ShiftMethodLine[];
  invoiceCount: number;
  salesTotal: string;
  cancelledCount: number;
  // Unpaid balance of invoices raised in the shift (sold on credit).
  creditTotal: string;
}

export interface ListShiftsQuery {
  page: number;
  limit: number;
  status?: "OPEN" | "CLOSED";
}

export interface ShiftRow {
  id: string;
  branchId: string;
  userId: string;
  user: { id: string; name: string } | null;
  counter: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  openedAt: Date;
  closedAt: Date | null;
  closeNote: string | null;
  counted: Record<string, string> | null;
}
