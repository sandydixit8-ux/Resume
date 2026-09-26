import type { PaymentProvider } from "./types";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe-provider";

export type { PaymentProvider, CheckoutLine, CheckoutSessionResult, ProviderWebhookEvent, PaymentStatus } from "./types";

/**
 * Resolve the active payment provider.
 * - STRIPE_SECRET_KEY set  → Stripe
 * - PAYMENT_PROVIDER=mock  → dev mock (explicit opt-in, allowed outside production)
 * - otherwise              → unconfigured stub (checkout returns 503 until keys exist)
 */
export function getPaymentProvider(): PaymentProvider {
  if (stripeProvider.isConfigured()) return stripeProvider;
  const explicit = process.env.PAYMENT_PROVIDER === "mock";
  const dev = process.env.NODE_ENV !== "production";
  if (explicit || dev) return mockProvider;
  return unconfiguredProvider;
}

export function paymentConfigured(): boolean {
  return getPaymentProvider().isConfigured();
}

const unconfiguredProvider: PaymentProvider = {
  name: "unconfigured",
  isConfigured: () => false,
  async createCustomer() {
    throw new Error("Payments are not configured");
  },
  async createCheckoutSession() {
    throw new Error("Payments are not configured");
  },
  async verifyWebhook() {
    return null;
  },
  async getCheckoutPaymentStatus() {
    return "unknown";
  },
  async refundPayment() {
    throw new Error("Payments are not configured");
  },
};
