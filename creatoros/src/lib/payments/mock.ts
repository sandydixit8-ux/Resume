import { nanoid } from "@/lib/db/db";
import type { CheckoutSessionResult, PaymentProvider, PaymentStatus, ProviderWebhookEvent } from "./types";

/**
 * Development-only payment provider. Creates "cs_mock_*" sessions whose
 * success redirect carries the session id; payment is confirmed server-side
 * by the success route (never by the frontend).
 *
 * Never active in production unless PAYMENT_PROVIDER=mock is set explicitly.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",
  isConfigured: () => true,

  async createCustomer(): Promise<{ customerId: string }> {
    return { customerId: `cus_mock_${nanoid(12)}` };
  },

  async createCheckoutSession({ successUrl }): Promise<CheckoutSessionResult> {
    const sessionId = `cs_mock_${nanoid(16)}`;
    const sep = successUrl.includes("?") ? "&" : "?";
    return { sessionId, url: `${successUrl}${sep}session_id=${sessionId}` };
  },

  async verifyWebhook(rawBody): Promise<ProviderWebhookEvent | null> {
    try {
      const parsed = JSON.parse(rawBody) as { id?: string; type?: string; data?: Record<string, unknown> };
      if (!parsed.id || !parsed.type) return null;
      return { id: parsed.id, type: parsed.type, data: parsed.data ?? {} };
    } catch {
      return null;
    }
  },

  async getCheckoutPaymentStatus(): Promise<PaymentStatus> {
    return "paid";
  },

  async refundPayment(): Promise<{ refundId: string }> {
    return { refundId: `re_mock_${nanoid(12)}` };
  },
};
