import type { HeldCartCreate } from "@erp-software/shared";

export type CreateHeldCartDto = HeldCartCreate;

export interface HeldCartDto {
  id: string;
  branchId: string;
  label: string | null;
  customerId: string | null;
  customerName: string | null;
  lineCount: number;
  // Total at the time it was held, for the list; resuming re-prices the cart.
  total: string;
  cart: HeldCartCreate;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
}

export interface CreateHeldCartData {
  branchId: string;
  userId: string;
  label: string | null;
  customerId: string | null;
  payload: HeldCartCreate & { total: string; customerName: string | null };
}
