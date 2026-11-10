import { describe, expect, it } from "vitest";
import {
  amountInWords,
  calculateGst,
  checkGstin,
  customerCreateSchema,
  financialYearLabel,
  financialYearStart,
  formatDocumentNumber,
  formatINR,
  formatMobile,
  gstinCheckChar,
  isValidMobile,
  normalizeRegNumber,
  numberToIndianWords,
  supplyTypeFor,
  SYSTEM_ROLES,
  PERMISSIONS,
  defaultSettings,
} from "./index.js";

describe("GST engine", () => {
  it("reproduces the A4 invoice design: ₹4,080 taxable → ₹4,814", () => {
    const t = calculateGst(
      [
        { quantity: 1, rate: 1450, gstRate: 18 }, // Periodic service (labour)
        { quantity: 3, rate: 520, gstRate: 18 }, // Castrol GTX 1L
        { quantity: 1, rate: 390, gstRate: 18 }, // Brake fluid
        { quantity: 1, rate: 385, gstRate: 18 }, // Air filter
        { quantity: 1, rate: 295, gstRate: 18 }, // Oil filter
      ],
      "INTRA_STATE",
    );
    expect(t.taxablePaise).toBe(408_000);
    expect(t.cgstPaise).toBe(36_720);
    expect(t.sgstPaise).toBe(36_720);
    expect(t.igstPaise).toBe(0);
    expect(t.roundOffPaise).toBe(-40);
    expect(t.totalPaise).toBe(481_400);
  });

  it("reproduces the POS design: ₹5,475 subtotal → ₹6,461", () => {
    const t = calculateGst(
      [
        { quantity: 1, rate: 295, gstRate: 18 },
        { quantity: 3, rate: 520, gstRate: 18 },
        { quantity: 1, rate: 1980, gstRate: 18 },
        { quantity: 4, rate: 410, gstRate: 18 },
      ],
      "INTRA_STATE",
    );
    expect(t.taxablePaise).toBe(547_500);
    expect(t.taxPaise).toBe(98_550);
    expect(t.roundOffPaise).toBe(50);
    expect(t.totalPaise).toBe(646_100);
  });

  it("charges IGST for inter-state supply", () => {
    const t = calculateGst([{ quantity: 2, rate: 1000, gstRate: 28 }], "INTER_STATE");
    expect(t.igstPaise).toBe(56_000);
    expect(t.cgstPaise + t.sgstPaise).toBe(0);
    expect(t.totalPaise).toBe(256_000);
  });

  it("back-calculates taxable value for tax-inclusive prices", () => {
    const t = calculateGst([{ quantity: 1, rate: 118, gstRate: 18, taxInclusive: true }], "INTRA_STATE");
    expect(t.taxablePaise).toBe(10_000);
    expect(t.taxPaise).toBe(1_800);
  });

  it("applies line discounts before tax and groups by rate", () => {
    const t = calculateGst(
      [
        { quantity: 1, rate: 1000, gstRate: 18, discount: 100 },
        { quantity: 1.5, rate: 200, gstRate: 5 },
      ],
      "INTRA_STATE",
    );
    expect(t.byRate.map((r) => [r.gstRate, r.taxablePaise])).toEqual([
      [5, 30_000],
      [18, 90_000],
    ]);
  });

  it("chooses supply type from place of supply", () => {
    expect(supplyTypeFor("32", "32")).toBe("INTRA_STATE");
    expect(supplyTypeFor("32", null)).toBe("INTRA_STATE");
    expect(supplyTypeFor("32", "29")).toBe("INTER_STATE");
  });
});

describe("amount in words", () => {
  it("matches the invoice design", () => {
    expect(amountInWords(4814)).toBe("Indian Rupees Four Thousand Eight Hundred Fourteen Only");
  });
  it("uses lakh and crore", () => {
    expect(numberToIndianWords(248_560)).toBe("Two Lakh Forty Eight Thousand Five Hundred Sixty");
    expect(numberToIndianWords(12_00_00_000)).toBe("Twelve Crore");
  });
  it("includes paise", () => {
    expect(amountInWords("1250.50")).toBe("Indian Rupees One Thousand Two Hundred Fifty and Fifty Paise Only");
  });
});

describe("formatting", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatINR(248560)).toBe("₹2,48,560");
    expect(formatINR(4814, { exact: true })).toBe("₹4,814.00");
  });
  it("formats mobile numbers", () => {
    expect(formatMobile("+91 98470-12345")).toBe("98470 12345");
    expect(isValidMobile("98470 1")).toBe(false);
    expect(isValidMobile("5847012345")).toBe(false);
  });
});

describe("GSTIN", () => {
  it("accepts a valid GSTIN and returns its state", () => {
    const gstin = "32AAAAA0000A1Z";
    const full = gstin + gstinCheckChar(gstin);
    expect(checkGstin(full)).toEqual({ valid: true, stateCode: "32" });
    expect(checkGstin("27AAPFU0939F1ZV").valid).toBe(true);
  });
  it("rejects a wrong check digit or format", () => {
    expect(checkGstin("27AAPFU0939F1ZA").valid).toBe(false);
    expect(checkGstin("1234").valid).toBe(false);
  });
});

describe("registration numbers", () => {
  it("normalizes common inputs", () => {
    expect(normalizeRegNumber("kl07cb4412")).toBe("KL 07 CB 4412");
    expect(normalizeRegNumber("KL-7-CB-412")).toBe("KL 07 CB 0412");
    expect(normalizeRegNumber("KL 41 F 2290")).toBe("KL 41 F 2290");
    expect(normalizeRegNumber("22BH1234AA")).toBe("22 BH 1234 AA");
    expect(normalizeRegNumber("hello")).toBeNull();
  });
});

describe("document numbers", () => {
  it("formats the series", () => {
    expect(formatDocumentNumber("INV", 2026, 1874, 5)).toBe("INV-26-01874");
  });
  it("switches financial year on 1 April IST", () => {
    expect(financialYearStart(new Date("2027-03-31T18:00:00Z"))).toBe(2026); // 31 Mar 23:30 IST
    expect(financialYearStart(new Date("2027-03-31T18:31:00Z"))).toBe(2027); // 1 Apr 00:01 IST
    expect(financialYearLabel(2026)).toBe("2026-27");
  });
});

describe("customer schema", () => {
  const base = { name: "Rakesh Menon", mobile: "98470 12345" };
  it("normalizes and defaults", () => {
    const c = customerCreateSchema.parse({ ...base, email: "", gstin: "" });
    expect(c).toMatchObject({ type: "RETAIL", mobile: "9847012345", email: null, gstin: null, creditLimit: 0 });
  });
  it("requires GSTIN for B2B and a matching state", () => {
    expect(customerCreateSchema.safeParse({ ...base, type: "B2B" }).success).toBe(false);
    expect(
      customerCreateSchema.safeParse({ ...base, type: "B2B", gstin: "27AAPFU0939F1ZV", stateCode: "32" }).success,
    ).toBe(false);
    expect(
      customerCreateSchema.safeParse({ ...base, type: "B2B", gstin: "27AAPFU0939F1ZV", stateCode: "27" }).success,
    ).toBe(true);
  });
});

describe("roles and settings", () => {
  it("system roles only use known permissions", () => {
    for (const role of Object.values(SYSTEM_ROLES)) {
      for (const p of role.permissions) expect(PERMISSIONS).toContain(p);
    }
  });
  it("settings have defaults", () => {
    expect(defaultSettings("tax")).toEqual({ defaultGstRate: 18, pricesIncludeTax: false, defaultLabourSac: "998714" });
    expect(defaultSettings("pos").maxDiscountPercent).toBe(5);
  });
});
