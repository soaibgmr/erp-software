import { ApiError } from "@/lib/api-client";
import type { ItemDetail, ItemSearchResult } from "@/lib/types";

export interface DraftLine {
  item: ItemSearchResult;
  // Kept as typed text so "-", "1." etc. can be edited; parsed on submit.
  quantity: string;
}

// Client-side checks before posting; the server re-validates everything.
export function lineErrors(lines: DraftLine[], signed: boolean): Record<number, string> {
  const errors: Record<number, string> = {};
  lines.forEach((l, i) => {
    const raw = l.quantity.trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) errors[i] = "Enter a quantity";
    else if (n === 0) errors[i] = "Can't be 0";
    else if (!signed && n < 0) errors[i] = "Must be more than 0";
    else if (Math.round(n * 1000) !== n * 1000 && Math.abs(Math.round(n * 1000) - n * 1000) > 1e-6)
      errors[i] = "At most 3 decimals";
  });
  return errors;
}

// The picker works with search results; an item opened from its detail page is converted to that shape.
export function toSearchResult(item: ItemDetail): ItemSearchResult {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    oemPartNo: item.oemPartNo,
    brandName: item.brand?.name ?? null,
    hsnCode: item.hsnCode,
    gstRate: item.gstRate,
    unit: item.unit,
    mrp: item.mrp,
    salePrice: item.salePrice,
    taxInclusive: item.taxInclusive,
    exact: false,
    stock: item.stock && {
      onHand: item.stock.onHand,
      reserved: item.stock.reserved,
      available: item.stock.available,
      status: item.stock.status,
    },
  };
}

// Maps "lines.2.quantity" style server errors onto line indexes.
export function serverLineErrors(err: unknown): { lines: Record<number, string>; fields: Record<string, string> } {
  const lines: Record<number, string> = {};
  const fields: Record<string, string> = {};
  if (err instanceof ApiError) {
    for (const [key, message] of Object.entries(err.fieldErrors)) {
      const m = /^lines\.(\d+)/.exec(key);
      if (m) lines[Number(m[1])] = message;
      else fields[key] = message;
    }
  }
  return { lines, fields };
}
