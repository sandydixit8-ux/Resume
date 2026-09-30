import type { PaymentProvider } from "./types";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe-provider";
import { cashfreeProvider } from "./cashfree-provider";

export type {
  PaymentProvider,
  CheckoutLine,
  CheckoutSessionResult,
  SubscriptionSessionResult,
  ProviderWebhookEvent,
  PaymentStatus,
} from "./types";

/**
 * Resolve the active payment provider.
 * - PAYMENT_PROVIDER=cashfree + CASHFREE_* set  -> Cashfree
 * - PAYMENT_PROVIDER=stripe   + STRIPE_SECRET_KEY set -> Stripe
 * - PAYMENT_PROVIDER=mock                           -> dev mock
 * - otherwise -> unconfigured stub (checkout returns 503 until keys exist)
 */
export function getPaymentProvider(): PaymentProvider {
  const preferred = (process.env.PAYMENT_PROVIDER || "").toLowerCase();

  if (preferred === "cashfree" && cashfreeProvider.isConfigured()) return cashfreeProvider;
  if (preferred === "stripe" && stripeProvider.isConfigured()) return stripeProvider;

  const explicit = preferred === "mock";
  const dev = process.env.NODE_ENV !== "production";
  if (explicit || dev) return mockProvider;
  return unconfiguredProvider;
}

export function paymentConfigured(): boolean {
  return getPaymentProvider().isConfigured();
}

/**
 * Cashfront mode for the browser SDK. It must mirror the server-side
 * environment or the hosted checkout will not resolve the session id.
 */
export function cashfreeSdkMode(): "sandbox" | "production" {
  return (process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "live" ? "production" : "sandbox";
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
  async createSubscriptionSession() {
    throw new Error("Payments are not configured");
  },
  async cancelSubscription() {
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
