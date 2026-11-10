import { describe, expect, it } from "vitest";
import { apportion, invoiceCreateSchema, paymentSummary, priceCart, shiftCloseSchema } from "./index.js";

describe("priceCart", () => {
  it("reproduces the POS design: ₹5,475 + 18% GST ₹985.50 → ₹6,461", () => {
    const cart = priceCart(
      [
        { quantity: 2, rate: 520, gstRate: 18 },
        { quantity: 1, rate: 1850, gstRate: 18 },
        { quantity: 4, rate: 295, gstRate: 18 },
        { quantity: 1, rate: 1405, gstRate: 18 },
      ],
      null,
      "INTRA_STATE",
    );
    expect(cart.grossPaise).toBe(547_500);
    expect(cart.taxPaise).toBe(98_550);
    expect(cart.roundOffPaise).toBe(50);
    expect(cart.totalPaise).toBe(646_100);
  });

  it("reproduces the A4 invoice: ₹4,080 taxable → ₹4,814 with −₹0.40 round off", () => {
    const cart = priceCart(
      [
        { quantity: 1, rate: 1450, gstRate: 18 },
        { quantity: 3, rate: 520, gstRate: 18 },
        { quantity: 1, rate: 390, gstRate: 18 },
        { quantity: 1, rate: 385, gstRate: 18 },
        { quantity: 1, rate: 295, gstRate: 18 },
      ],
      null,
      "INTRA_STATE",
    );
    expect(cart.taxablePaise).toBe(408_000);
    expect(cart.cgstPaise).toBe(36_720);
    expect(cart.roundOffPaise).toBe(-40);
    expect(cart.totalPaise).toBe(481_400);
  });

  it("apportions a bill discount by line amount, exactly", () => {
    const cart = priceCart(
      [
        { quantity: 1, rate: 1000, gstRate: 18 },
        { quantity: 1, rate: 333.33, gstRate: 5 },
        { quantity: 1, rate: 166.67, gstRate: 28, discount: 66.67 },
      ],
      { type: "AMOUNT", value: 100 },
      "INTRA_STATE",
    );
    const shares = cart.lines.map((l) => l.billDiscountPaise);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(shares[0]).toBeGreaterThan(shares[1]!);
    expect(cart.discountPaise).toBe(6_667 + 10_000);
    expect(cart.taxablePaise).toBe(150_000 - 16_667);
  });

  it("percent bill discounts apply to the amount after line discounts", () => {
    const cart = priceCart(
      [{ quantity: 2, rate: 500, gstRate: 18, discount: 100 }],
      { type: "PERCENT", value: 10 },
      "INTRA_STATE",
    );
    expect(cart.billDiscountPaise).toBe(9_000); // 10% of 900
    expect(cart.discountBasisPoints).toBe(1_900); // 190 of 1000 = 19%
  });

  it("charges IGST at the full rate across states", () => {
    const cart = priceCart([{ quantity: 1, rate: 1000, gstRate: 18 }], null, "INTER_STATE");
    expect([cart.cgstPaise, cart.sgstPaise, cart.igstPaise]).toEqual([0, 0, 18_000]);
  });

  it("back-calculates tax-inclusive prices, after the discount", () => {
    const cart = priceCart(
      [{ quantity: 1, rate: 118, gstRate: 18, taxInclusive: true, discount: 18 }],
      null,
      "INTRA_STATE",
    );
    expect(cart.taxablePaise).toBe(8_475); // 100 / 1.18
    expect(cart.totalPaise).toBe(10_000);
  });

  it("reports discounts larger than the amount and clamps them", () => {
    const cart = priceCart(
      [{ quantity: 1, rate: 100, gstRate: 0, discount: 150 }],
      { type: "AMOUNT", value: 10 },
      "INTRA_STATE",
    );
    expect(cart.issues.map((i) => i.message)).toContain("Discount is more than the line amount");
    expect(cart.totalPaise).toBe(0);
  });
});

describe("apportion", () => {
  it("sums exactly and favours the largest remainders", () => {
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(apportion(0, [5, 5])).toEqual([0, 0]);
    expect(apportion(7, [0, 10])).toEqual([0, 7]);
  });
});

describe("payments", () => {
  it("summarises split payments and cash change", () => {
    const s = paymentSummary(646_100, [
      { mode: "CASH", amount: 2000, tendered: 2500 },
      { mode: "UPI", amount: 3000 },
    ]);
    expect(s).toEqual({ paidPaise: 500_000, duePaise: 146_100, overPaise: 0, changePaise: 50_000 });
  });

  it("validates tendered cash and line kinds", () => {
    const item = { kind: "ITEM", itemId: "40000000-0000-4000-8000-000000000001", quantity: 1 };
    expect(
      invoiceCreateSchema.safeParse({ lines: [item], payments: [{ mode: "CASH", amount: 100, tendered: 50 }] }).success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({ lines: [item], payments: [{ mode: "UPI", amount: 100, tendered: 200 }] }).success,
    ).toBe(false);
    expect(invoiceCreateSchema.safeParse({ lines: [{ ...item, kind: "LABOUR" }] }).success).toBe(false);
    expect(invoiceCreateSchema.parse({ lines: [item] }).payments).toEqual([]);
    expect(shiftCloseSchema.parse({ counted: { CASH: "1200" } }).counted).toEqual({ CASH: 1200 });
  });
});
