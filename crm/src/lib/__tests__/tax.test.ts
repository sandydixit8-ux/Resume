import { describe, expect, it } from "vitest";
import { gstBreakdown, round2, lineSubtotal, computeLine, computeTotals, discountAmount } from "@/lib/tax";

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(2.005)).toBe(2.01);
    expect(round2(10)).toBe(10);
    expect(round2(10.129)).toBe(10.13);
  });
});

describe("gstBreakdown", () => {
  it("splits tax into CGST + SGST for intra-state sales", () => {
    const r = gstBreakdown(1000, 18, "intra");
    expect(r.cgst).toBe(90);
    expect(r.sgst).toBe(90);
    expect(r.igst).toBe(0);
    expect(r.totalTax).toBe(180);
    expect(r.taxable).toBe(1000);
    expect(r.type).toBe("intra");
  });

  it("uses IGST for inter-state sales", () => {
    const r = gstBreakdown(1000, 18, "inter");
    expect(r.igst).toBe(180);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
    expect(r.totalTax).toBe(180);
  });

  it("handles non-integer rates and amounts", () => {
    const r = gstBreakdown(333.33, 12.5, "intra");
    expect(r.cgst).toBeCloseTo(20.83, 2);
    expect(r.sgst).toBeCloseTo(20.83, 2);
    expect(r.totalTax).toBeCloseTo(41.66, 2);
  });
});

describe("lineSubtotal", () => {
  it("computes pre-tax line total with discount", () => {
    expect(lineSubtotal({ quantity: 10, unitPrice: 100, discountPercent: 10 })).toBe(900);
  });

  it("computes line total without discount", () => {
    expect(lineSubtotal({ quantity: 5, unitPrice: 120, discountPercent: 0 })).toBe(600);
  });
});

describe("computeLine", () => {
  it("returns subtotal, tax and total for a line", () => {
    const r = computeLine({ quantity: 10, unitPrice: 100, discountPercent: 10, taxRate: 18 });
    expect(r.subtotal).toBe(900);
    expect(r.tax).toBe(162);
    expect(r.total).toBe(1062);
  });
});

describe("computeTotals", () => {
  it("sums subtotals and tax into a grand total", () => {
    const r = computeTotals([
      { subtotal: 900, tax: 162 },
      { subtotal: 600, tax: 0 },
    ]);
    expect(r.subtotal).toBe(1500);
    expect(r.tax_amount).toBe(162);
    expect(r.total).toBe(1662);
  });
});

describe("discountAmount", () => {
  it("computes discount from a percentage", () => {
    expect(discountAmount(1000, 10)).toBe(100);
    expect(discountAmount(1000, 0)).toBe(0);
  });
});
