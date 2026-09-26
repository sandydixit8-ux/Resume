export function formatPrice(cents: number, currency = "usd"): string {
  const value = (cents / 100).toFixed(2);
  return currency === "inr" ? `₹${value}` : `$${value}`;
}
