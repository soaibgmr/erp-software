import type { Prisma } from "@prisma/client";
import { milliToDecimal, stockStatus, toMilli } from "@automobile/shared";
import type { ItemStockDto } from "../items/item.types";

type Qty = Prisma.Decimal | string | number;

export interface BranchStockRow {
  branchId: string;
  onHand: Qty;
  reserved: Qty;
  inTransit: Qty;
  minLevel: Qty;
  reorderQty: Qty;
  binLocation: string | null;
}

const milli = (q: Qty) => toMilli(q.toString());

export function toStockDto(row: BranchStockRow): ItemStockDto {
  const available = milli(row.onHand) - milli(row.reserved);
  return {
    branchId: row.branchId,
    onHand: milliToDecimal(milli(row.onHand)),
    reserved: milliToDecimal(milli(row.reserved)),
    available: milliToDecimal(available),
    inTransit: milliToDecimal(milli(row.inTransit)),
    minLevel: milliToDecimal(milli(row.minLevel)),
    reorderQty: milliToDecimal(milli(row.reorderQty)),
    binLocation: row.binLocation,
    status: stockStatus(available / 1000, milli(row.minLevel) / 1000),
  };
}

// A branch that has never held the item.
export const emptyStock = (branchId: string): ItemStockDto =>
  toStockDto({ branchId, onHand: 0, reserved: 0, inTransit: 0, minLevel: 0, reorderQty: 0, binLocation: null });
