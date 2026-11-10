import { describe, expect, it } from "vitest";
import { CODE128_PATTERNS, code128Bars, code128Values, isCode128B } from "./code128";

describe("Code 128 B", () => {
  it("every symbol is 11 modules wide (stop is 13)", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((p, i) => {
      const width = [...p].reduce((s, c) => s + Number(c), 0);
      expect(width, `symbol ${i}`).toBe(i === 106 ? 13 : 11);
    });
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
  });

  it("starts with Start B, ends with the stop pattern", () => {
    const bars = code128Bars("OF-1");
    expect(code128Values("OF-1")[0]).toBe(104);
    expect(bars.slice(0, 6).join("")).toBe("211214");
    expect(bars.slice(-7).join("")).toBe("2331112");
  });

  it("computes the mod-103 checksum", () => {
    // 104 + 1·48 + 2·42 + 3·42 + 4·17 + 5·18 + 6·19 + 7·35 = 879; 879 mod 103 = 55
    const values = code128Values("PJJ123C");
    expect(values.slice(1, -2)).toEqual([48, 42, 42, 17, 18, 19, 35]);
    expect(values.at(-2)).toBe(55);
  });

  it("rejects characters outside printable ASCII", () => {
    expect(isCode128B("ABC-123")).toBe(true);
    expect(isCode128B("₹10")).toBe(false);
    expect(() => code128Values("")).toThrow();
  });
});
