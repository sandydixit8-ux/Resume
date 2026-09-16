"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import type { CartDto, PaymentMethodValue } from "@nexus/contracts";
import { cartApi, checkoutApi, getCartToken, getStoredToken } from "@/lib/api";
import { formatINR } from "@/lib/format";

const PAYMENT_METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "NET_BANKING", label: "Net Banking" },
  { value: "COD", label: "Cash on Delivery" },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [email, setEmail] = useState("");
  const idempotencyKey = useMemo(() => `checkout_${crypto.randomUUID()}`, []);
  const isAuthed = !!getStoredToken();

  useEffect(() => {
    cartApi
      .getCart()
      .then((c) => {
        setCart(c);
        if (!c || c.items.length === 0) router.replace("/cart");
      })
      .catch(() => router.replace("/cart"))
      .finally(() => setLoading(false));
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cart) return;
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        cartToken: getCartToken() ?? undefined,
        email: isAuthed ? undefined : email,
        phone,
        shippingAddress: { fullName, phone, line1, line2, city, state, pincode, country: "IN" },
        paymentMethod,
        idempotencyKey,
      };
      const result = isAuthed ? await checkoutApi.placeOrder(input) : await checkoutApi.placeGuestOrder(input);
      router.push(`/order/${result.order.id}/confirmation?session=${encodeURIComponent(result.session.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page py-8">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-4 text-sm text-muted-foreground">Loading cart…</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) return null;

  const addressFields: {
    label: string;
    id: string;
    value: string;
    set: (value: string) => void;
    required?: boolean;
    minLength?: number;
    pattern?: string;
  }[] = [
    { label: "Full name", id: "fullName", value: fullName, set: setFullName, required: true, minLength: 2 },
    { label: "Phone", id: "phone", value: phone, set: setPhone, required: true, pattern: "^[0-9+]{7,20}$" },
    { label: "Address line 1", id: "line1", value: line1, set: setLine1, required: true },
    { label: "Address line 2 (optional)", id: "line2", value: line2, set: setLine2 },
    { label: "City", id: "city", value: city, set: setCity, required: true },
    { label: "State", id: "state", value: state, set: setState, required: true },
    { label: "Pincode", id: "pincode", value: pincode, set: setPincode, required: true, pattern: "^\\d{6}$" },
  ];

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">Checkout</h1>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form id="checkout-form" onSubmit={submit} className="space-y-6">
          {!isAuthed && (
            <fieldset>
              <legend className="text-sm font-semibold">Contact email</legend>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </fieldset>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Shipping address</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {addressFields.map((field) => (
                <div key={field.id} className={field.id === "line1" || field.id === "line2" ? "sm:col-span-2" : ""}>
                  <label htmlFor={field.id} className="text-sm font-medium text-muted-foreground">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    required={field.required ?? false}
                    minLength={field.minLength}
                    pattern={field.pattern}
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Payment method</legend>
            <div className="mt-2 space-y-2">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                    className="accent-primary"
                  />
                  {method.label}
                </label>
              ))}
            </div>
            {paymentMethod === "COD" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Pay the delivery partner at your doorstep. No online payment required.
              </p>
            )}
          </fieldset>
        </form>

        <aside className="h-fit rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between text-sm">
                <div className="pr-3">
                  <p className="font-medium leading-tight">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantName} × {item.quantity}
                  </p>
                </div>
                <span className="whitespace-nowrap font-medium">{formatINR(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal ({cart.totals.itemCount} item{cart.totals.itemCount === 1 ? "" : "s"})</dt>
              <dd>{formatINR(cart.totals.subtotal)}</dd>
            </div>
            {Number(cart.totals.discount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Promo discount</dt>
                <dd className="font-medium text-success">−{formatINR(cart.totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{Number(cart.totals.subtotal) >= 499 ? "Free" : "₹49.00"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
            <span>Total</span>
            <span>
              {formatINR(
                Number(cart.totals.subtotal) >= 499
                  ? Number(cart.totals.subtotal) - Number(cart.totals.discount)
                  : Number(cart.totals.subtotal) + 49 - Number(cart.totals.discount),
              )}
            </span>
          </div>
          <Button type="submit" form="checkout-form" className="mt-6 w-full" disabled={submitting}>
            {submitting ? "Placing order…" : "Place order"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            By placing this order you agree to our terms (coming soon).
          </p>
        </aside>
      </div>
    </div>
  );
}