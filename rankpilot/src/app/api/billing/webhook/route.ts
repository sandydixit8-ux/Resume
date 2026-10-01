import { NextRequest, NextResponse } from "next/server";
import { stripeConfig, verifyWebhookSignature, parseStripeEvent } from "@/lib/billing/stripe";
import { applySubscriptionEvent } from "@/lib/billing/subscriptions";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/webhook — Stripe event delivery.
 *
 * Stripe signs the raw body with `Stripe-Signature: t=...,v1=...`. We verify it
 * against STRIPE_WEBHOOK_SECRET before trusting anything in the JSON, then apply
 * the lifecycle events. A forged or malformed signature is answered with 400 and
 * never touches the database; Stripe retries with a fresh (valid) signature.
 *
 * Idempotency: applying `checkout.session.completed` twice would re-grant the
 * same plan (harmless), but to keep replays from accumulating subscription rows
 * we upsert on a deterministic key rather than inserting duplicates. A genuine
 * event that names an unknown tenant raises, which surfaces a real desync
 * instead of silently pretending the checkout was applied.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  const cfg = stripeConfig();
  if ("problem" in cfg) {
    log.warn("billing.webhook.unconfigured");
    return NextResponse.json(
      { ok: false, error: { code: "stripe_not_configured", message: cfg.problem } },
      { status: 503 }
    );
  }

  if (!verifyWebhookSignature(raw, signature, cfg.config.webhookSecret)) {
    log.warn("billing.webhook.bad_signature");
    return NextResponse.json(
      { ok: false, error: { code: "invalid_signature", message: "Signature verification failed" } },
      { status: 400 }
    );
  }

  const event = parseStripeEvent(raw);
  if (!event) {
    log.warn("billing.webhook.unparseable");
    return NextResponse.json(
      { ok: false, error: { code: "invalid_event", message: "Malformed event body" } },
      { status: 400 }
    );
  }

  try {
    const change = applySubscriptionEvent(cfg.config, event);
    if (change) {
      audit({
        tenantId: change.tenantId,
        action: "billing.webhook_applied",
        entity: "organization",
        entityId: change.tenantId,
        meta: { type: event.type, plan: change.plan, status: change.status },
      });
      log.info("billing.webhook.applied", {
        type: event.type,
        tenantId: change.tenantId,
        plan: change.plan,
        status: change.status,
      });
    }
  } catch (e) {
    log.error("billing.webhook.apply_failed", {
      type: event.type,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: { code: "apply_failed", message: "Webhook could not be applied" } },
      { status: 500 }
    );
  }

  // Stripe expects an empty 200 for the event; the applied state is in the DB.
  return new NextResponse(null, { status: 200 });
}