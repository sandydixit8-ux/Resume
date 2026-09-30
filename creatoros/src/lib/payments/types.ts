export interface CheckoutLine {
  title: string;
  amountCents: number;
  quantity: number;
}

/** Recurring (monthly) subscription checkout for a plan upgrade. */
export interface SubscriptionSessionInput {
  planKey: string;
  planName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface ProviderWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export type PaymentStatus = "paid" | "unpaid" | "unknown";

/**
 * Payment provider abstraction (spec §9). All billing/checkout code depends
 * only on this interface; Stripe and the dev mock implement it.
 */
export interface PaymentProvider {
  readonly name: string;
  /** False when the provider cannot create sessions (missing credentials). */
  isConfigured(): boolean;
  createCustomer(input: { email: string; name?: string }): Promise<{ customerId: string }>;
  createCheckoutSession(input: {
    lines: CheckoutLine[];
    currency: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    /** Required by Cashfree for domestic rails; ignored by Stripe. */
    customerPhone?: string;
    metadata: Record<string, string>;
  }): Promise<CheckoutSessionResult>;
  /** One-time checkout is not enough for plans — a recurring monthly session. */
  createSubscriptionSession(input: SubscriptionSessionInput): Promise<CheckoutSessionResult>;
  cancelSubscription(providerId: string): Promise<{ subscriptionId: string }>;
  /** Verify webhook signature and parse the event. Returns null when invalid. */
  verifyWebhook(rawBody: string, signature: string, timestamp?: string): Promise<ProviderWebhookEvent | null>;
  getCheckoutPaymentStatus(sessionId: string): Promise<PaymentStatus>;
  refundPayment(input: { sessionId: string; amountCents?: number }): Promise<{ refundId: string }>;
}
