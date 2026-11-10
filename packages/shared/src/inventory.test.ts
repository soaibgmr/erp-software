import { describe, expect, it } from "vitest";
import {
  csvToObjects,
  customerUpdateSchema,
  itemCreateSchema,
  itemImportRowSchema,
  itemUpdateSchema,
  parseCsv,
  patchOf,
  posSettingsSchema,
  stockAdjustmentCreateSchema,
  stockStatus,
  toCsv,
  userUpdateSchema,
} from "./index.js";

describe("patchOf", () => {
  it("doesn't fill defaults into a PATCH body", () => {
    expect(customerUpdateSchema.parse({ name: "Asha" })).toEqual({ name: "Asha" });
    expect(itemUpdateSchema.parse({ salePrice: "300" })).toEqual({ salePrice: 300 });
    expect(userUpdateSchema.parse({ phone: "" })).toEqual({ phone: null });
    expect(patchOf(posSettingsSchema).parse({ maxDiscountPercent: "10" })).toEqual({ maxDiscountPercent: 10 });
  });

  it("stays strict", () => {
    expect(itemUpdateSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });
});

describe("stockStatus", () => {
  it("out, low and in stock", () => {
    expect(stockStatus("0", "5")).toBe("OUT");
    expect(stockStatus(-1, 0)).toBe("OUT");
    expect(stockStatus("5.000", "5.000")).toBe("LOW");
    expect(stockStatus(5.001, 5)).toBe("IN_STOCK");
    expect(stockStatus(1, 0)).toBe("IN_STOCK");
  });
});

describe("item schema", () => {
  const base = { sku: "of-bsh 2341".replace(" ", "-"), name: "Oil filter", salePrice: "295" };

  it("uppercases the SKU and applies defaults on create", () => {
    const item = itemCreateSchema.parse(base);
    expect(item).toMatchObject({ sku: "OF-BSH-2341", gstRate: 18, unit: "PCS", purchasePrice: 0, barcodes: [] });
  });

  it("price with GST can't exceed MRP", () => {
    expect(itemCreateSchema.safeParse({ ...base, salePrice: "400", mrp: "450" }).success).toBe(false); // 472
    expect(itemCreateSchema.safeParse({ ...base, salePrice: "380", mrp: "450" }).success).toBe(true); // 448.40
    expect(itemCreateSchema.safeParse({ ...base, salePrice: "450", mrp: "450", taxInclusive: true }).success).toBe(
      true,
    );
  });

  it("rejects duplicate barcodes", () => {
    expect(itemCreateSchema.safeParse({ ...base, barcodes: ["8901", "8901"] }).success).toBe(false);
  });
});

describe("stock adjustment schema", () => {
  const line = { itemId: "40000000-0000-4000-8000-000000000001", quantity: "-2" };
  it("needs a note for OTHER and refuses zero or repeated lines", () => {
    expect(stockAdjustmentCreateSchema.safeParse({ reason: "OTHER", lines: [line] }).success).toBe(false);
    expect(
      stockAdjustmentCreateSchema.safeParse({ reason: "DAMAGE", lines: [{ ...line, quantity: "0" }] }).success,
    ).toBe(false);
    expect(stockAdjustmentCreateSchema.safeParse({ reason: "DAMAGE", lines: [line, line] }).success).toBe(false);
    expect(stockAdjustmentCreateSchema.parse({ reason: "DAMAGE", lines: [line] }).lines[0]!.quantity).toBe(-2);
  });
});

describe("CSV", () => {
  it("parses quotes, escaped quotes, CRLF and a BOM", () => {
    const text = '﻿sku,name,salePrice\r\nOF-1,"Filter, oil ""premium""",1250\r\n\r\nOF-2,Plug,180\n';
    expect(parseCsv(text)).toEqual([
      ["sku", "name", "salePrice"],
      ["OF-1", 'Filter, oil "premium"', "1250"],
      ["OF-2", "Plug", "180"],
    ]);
    expect(csvToObjects(text).rows[1]).toEqual({ sku: "OF-2", name: "Plug", salePrice: "180" });
  });

  it("round-trips through toCsv", () => {
    const rows = [
      ["a", 'b "c"', "d,e"],
      ["1", "", "x\ny"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("import rows: blanks take defaults, commas in numbers are fine", () => {
    const row = itemImportRowSchema.parse({
      sku: "x-1",
      name: "Pad",
      salePrice: "1,250",
      unit: "set",
      taxInclusive: "Yes",
    });
    expect(row).toMatchObject({
      sku: "X-1",
      salePrice: 1250,
      gstRate: 18,
      unit: "SET",
      taxInclusive: true,
      openingQty: 0,
      mrp: null,
    });
    expect(itemImportRowSchema.safeParse({ sku: "x", name: "y", salePrice: "" }).success).toBe(false);
  });
});
