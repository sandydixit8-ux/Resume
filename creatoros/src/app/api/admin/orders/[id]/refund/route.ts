import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { getPaymentProvider } from "@/lib/payments";
import { row, nowIso } from "@/lib/db/db";
import { markOrderFailed } from "@/lib/store/orders";
import { audit } from "@/lib/audit";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const schema = z.object({
  /** Omit for a full refund; otherwise the partial amount in major units. */
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(200).default("admin refund"),
});

interface RefundableOrder {
  id: string;
  status: string;
  provider: string | null;
  provider_session_id: string | null;
  total_cents: number;
}

/**
 * Platform-admin refund. Cashfree/Stripe both refund by the provider session
 * id we stored at checkout, so the order must already be paid.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();

  const rl = rateLimit(rateKey("admin_refund", s.user.id), 30);
  if (!rl.allowed) return err.rateLimited();

  const { id } = await ctx.params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const order = row<RefundableOrder>("SELECT id, status, provider, provider_session_id, total_cents FROM orders WHERE id = ?", id);
  if (!order) return err.notFound();
  if (order.status !== "paid") return err.conflict(`Only paid orders can be refunded (this one is ${order.status})`);
  if (!order.provider_session_id) return err.conflict("This order has no provider session recorded");

  const amountCents = parsed.data.amountCents ?? order.total_cents;
  if (amountCents > order.total_cents) {
    return err.validation({ amountCents: ["Cannot refund more than the order total"] });
  }

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) return err.server();

  try {
    const { refundId } = await provider.refundPayment({
      sessionId: order.provider_session_id,
      amountCents,
    });
    markOrderFailed(order.id, "refunded");
    audit({
      tenantId: order.id,
      action: "admin.order_refunded",
      resource: order.id,
      meta: {
        refundId,
        amountCents,
        provider: provider.name,
        reason: parsed.data.reason,
        admin: s.user.email,
        at: nowIso(),
      },
    });
    return ok({ refundId, orderId: order.id, amountCents, provider: provider.name });
  } catch (e) {
    return err.conflict(e instanceof Error ? e.message : "Refund failed at provider");
  }
}
