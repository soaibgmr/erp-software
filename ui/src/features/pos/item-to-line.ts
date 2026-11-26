import type { CartLine } from "./cart";

export type NewLine = Omit<CartLine, "quantity" | "discount">;

export const itemToLine = (i: {
  id: string;
  name: string;
  sku: string;
  unit: string;
  salePrice: string;
  gstRate: number;
  taxInclusive: boolean;
  stock: { available: string } | null;
}): NewLine => ({
  kind: "ITEM",
  id: i.id,
  name: i.name,
  sku: i.sku,
  unit: i.unit,
  rate: Number(i.salePrice),
  gstRate: i.gstRate,
  taxInclusive: i.taxInclusive,
  available: i.stock ? Number(i.stock.available) : 0,
});
