const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
const RATE = 84;

export function formatMoneyCents(cents: number): string {
  const value = cents / 100;
  return `${USD.format(value)} · ${INR.format(value * RATE)}`;
}