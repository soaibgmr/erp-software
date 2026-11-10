import { describe, expect, it } from "vitest";
import { cartReducer, emptyCart, isScan, lineKey, toCartBody, type CartLine } from "./cart";

const oil: Omit<CartLine, "quantity" | "discount"> = {
  kind: "ITEM",
  id: "item-1",
  name: "Castrol GTX 1L",
  sku: "OIL-1",
  unit: "PCS",
  rate: 520,
  gstRate: 18,
  taxInclusive: false,
  available: 10,
};

describe("isScan", () => {
  it("treats a fast burst as a scan and slow typing as search", () => {
    expect(isScan([0, 8, 15, 22, 30, 37])).toBe(true);
    expect(isScan([0, 120, 260, 400])).toBe(false);
    expect(isScan([0, 5, 10])).toBe(false); // too short
    expect(isScan([0, 5, 10, 60, 65])).toBe(false); // one slow gap
  });
});

describe("cartReducer", () => {
  it("adds, merges and steps lines; stepping to zero removes", () => {
    let s = cartReducer(emptyCart(), { type: "add", line: oil });
    s = cartReducer(s, { type: "add", line: oil, quantity: 2 });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.quantity).toBe("3");
    s = cartReducer(s, { type: "step", key: lineKey(oil), delta: -3 });
    expect(s.lines).toHaveLength(0);
  });

  it("changes the idempotency key whenever the cart changes", () => {
    const a = emptyCart();
    const b = cartReducer(a, { type: "add", line: oil });
    const c = cartReducer(b, { type: "setDiscount", key: lineKey(oil), discount: 10 });
    expect(new Set([a.idempotencyKey, b.idempotencyKey, c.idempotencyKey]).size).toBe(3);
  });

  it("builds the API body from ids, quantities and discounts", () => {
    let s = cartReducer(emptyCart(), { type: "add", line: oil, quantity: 1.5 });
    s = cartReducer(s, { type: "add", line: { ...oil, kind: "LABOUR", id: "lab-1", available: null } });
    s = cartReducer(s, { type: "setQty", key: "ITEM:item-1", quantity: "" });
    s = cartReducer(s, { type: "setBillDiscount", billDiscount: { type: "PERCENT", value: 0 } });
    expect(toCartBody(s)).toEqual({
      customerId: null,
      lines: [{ kind: "LABOUR", labourServiceId: "lab-1", quantity: 1, discount: 0 }],
      billDiscount: null,
    });
  });
});
