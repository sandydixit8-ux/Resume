/**
 * GST tax calculation. All money computations for quotations/orders/invoices
 * are server-side; this pure module is unit-tested.
 *
 * - For intra-state sales: CGST + SGST (each tax_rate/2).
 * - For inter-state sales: IGST (tax_rate).
 * Returns amounts rounded to 2 decimals.
 */

export interface TaxBreakdown {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  type: "intra" | "inter";
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function gstBreakdown(taxable: number, taxRate: number, type: "intra" | "inter" = "intra"): TaxBreakdown {
  const taxableR = round2(taxable);
  const rate = Number(taxRate) || 0;

  if (type === "inter") {
    const igst = round2((taxableR * rate) / 100);
    return { taxable: taxableR, cgst: 0, sgst: 0, igst, totalTax: igst, type };
  }

  const half = round2((taxableR * rate) / 200);
  return {
    taxable: taxableR,
    cgst: half,
    sgst: half,
    igst: 0,
    totalTax: round2(half + half),
    type,
  };
}

export interface LineSubtotalInput {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export interface LineTaxInput extends LineSubtotalInput {
  taxRate: number;
}

export function lineSubtotal({ quantity, unitPrice, discountPercent }: LineSubtotalInput): number {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const discount = Number(discountPercent) || 0;
  const base = qty * price;
  return round2(base - (base * discount) / 100);
}

/** Compute a full line (subtotal, tax, total). Used by quote/order/invoice build. */
export function computeLine(input: LineTaxInput): { subtotal: number; tax: number; total: number } {
  const subtotal = lineSubtotal(input);
  const tax = round2((subtotal * (Number(input.taxRate) || 0)) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function computeTotals(lines: { subtotal: number; tax: number }[]): {
  subtotal: number;
  tax_amount: number;
  total: number;
} {
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const tax_amount = round2(lines.reduce((s, l) => s + l.tax, 0));
  return { subtotal, tax_amount, total: round2(subtotal + tax_amount) };
}

export function discountAmount(subtotal: number, discountPercent: number): number {
  return round2((subtotal * (Number(discountPercent) || 0)) / 100);
}
