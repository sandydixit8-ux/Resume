import { NextRequest } from "next/server";
import { run, row, nowIso } from "@/lib/db/db";
import { getPaymentProvider } from "@/lib/payments";
import { fulfillOrderBySession, markOrderFailed, type FulfillResult } from "@/lib/store/orders";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

/**
 * Payment provider webhook (spec §9): signature-verified, idempotent,
 * records every event in webhook_events before processing.
 */
export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (provider.name === "unconfigured") return fail("Payments not configured", 503, "payments_not_configured");

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  const event = await provider.verifyWebhook(raw, signature);
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

  const sessionId = typeof event.data.id === "string" ? event.data.id : "";
  let result: FulfillResult | "ignored" = "ignored";

  switch (event.type) {
    case "checkout.session.completed":
      if (sessionId) result = fulfillOrderBySession(sessionId);
      break;
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

  if (result === "paid") {
    audit({ action: "store.webhook_fulfilled", resource: sessionId });
  }

  return ok({ received: true, result });
}
