import { NextRequest } from "next/server";
import { run, row, nowIso } from "@/lib/db/db";
import { getPaymentProvider } from "@/lib/payments";
import { fulfillOrderBySession, markOrderFailed, type FulfillResult } from "@/lib/store/orders";
import { applySubscription } from "@/lib/billing/subscriptions";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Payment provider webhook (spec §9): signature-verified, idempotent,
 * records every event in webhook_events before processing. Handles both
 * one-time product/course purchases and recurring plan subscriptions.
 */
export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (provider.name === "unconfigured") return fail("Payments not configured", 503, "payments_not_configured");

  const raw = await req.text();
  const cashfree = provider.name === "cashfree";
  const signature = (cashfree ? req.headers.get("x-webhook-signature") : req.headers.get("stripe-signature")) || "";
  const timestamp = (cashfree ? req.headers.get("x-webhook-timestamp") : "") || "";
  const event = await provider.verifyWebhook(raw, signature, timestamp);
  if (!event) return fail("Invalid signature", 400, "invalid_signature");

  // Idempotency: a duplicate delivery must not process twice.
  const existed = row("SELECT id FROM webhook_events WHERE id = ?", event.id);
  if (existed) return ok({ received: true, duplicate: true });
  try {
    run(
      "INSERT INTO webhook_events (id, provider, type, payload, processed_at) VALUES (?, ?, ?, ?, ?)",
      event.id,
      provider.name,
      event.type,
      JSON.stringify(event.data).slice(0, 10000),
      nowIso()
    );
  } catch {
    // concurrent duplicate won the insert race — treat as processed
    return ok({ received: true, duplicate: true });
  }

  const sessionId = str(event.data.id);
  let result: FulfillResult | "subscription_applied" | "ignored" | "error" = "ignored";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // A subscription session carries mode="subscription" + metadata.
        if (event.data.mode === "subscription") {
          const metadata = (event.data.metadata ?? {}) as Record<string, unknown>;
          const tenantId = str(metadata.tenantId);
          const plan = str(metadata.plan);
          if (tenantId && plan) {
            applySubscription({
              tenantId,
              plan,
              provider: provider.name,
              providerId: str(event.data.subscription),
              customerId: str(event.data.customer),
              status: "active",
              currentPeriodEnd: str(event.data.currentPeriodEnd) || null,
            });
            audit({ tenantId, action: "billing.webhook_subscription", resource: plan, meta: { event: event.id } });
            result = "subscription_applied";
          }
        } else if (sessionId) {
          result = fulfillOrderBySession(sessionId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data as Record<string, unknown>;
        const metadata = (sub.metadata ?? {}) as Record<string, unknown>;
        const tenantId = str(metadata.tenantId);
        if (tenantId) {
          const plan = str(metadata.plan) || "free";
          const status = str(sub.status);
          const providerId = str(sub.id);
          applySubscription({
            tenantId,
            plan,
            provider: provider.name,
            providerId,
            customerId: str(sub.customer),
            status: status || "active",
            currentPeriodEnd: str(sub.current_period_end) || null,
          });
          result = "subscription_applied";
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data as Record<string, unknown>;
        const metadata = (sub.metadata ?? {}) as Record<string, unknown>;
        const tenantId = str(metadata.tenantId);
        if (tenantId) {
          applySubscription({
            tenantId,
            plan: str(metadata.plan) || "free",
            provider: provider.name,
            providerId: str(sub.id),
            customerId: str(sub.customer),
            status: "canceled",
          });
          audit({ tenantId, action: "billing.webhook_subscription_deleted", resource: str(sub.id) });
          result = "subscription_applied";
        }
        break;
      }
      case "checkout.session.expired":
        if (sessionId) {
          const order = row<{ id: string }>("SELECT id FROM orders WHERE provider_session_id = ? AND status = 'pending'", sessionId);
          if (order) {
            markOrderFailed(order.id, "canceled");
            result = "not_payable";
          }
        }
        break;
      default:
        result = "ignored";
    }
  } catch (e) {
    // The event is already persisted in webhook_events, so a retry would be a
    // duplicate no-op. Log and acknowledge to stop the gateway retry loop.
    result = "error";
    console.error(`[webhook] ${provider.name} ${event.type} ${event.id} failed:`, e);
  }

  if (result === "paid") {
    audit({ action: "store.webhook_fulfilled", resource: sessionId });
  }

  return ok({ received: true, result });
}
