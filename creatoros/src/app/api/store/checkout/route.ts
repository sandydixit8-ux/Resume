import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp } from "@/lib/http";
import { row } from "@/lib/db/db";
import { getPaymentProvider } from "@/lib/payments";
import { getProduct, createOrderForProduct, attachCheckoutSession } from "@/lib/store/orders";
import { getLimits } from "@/lib/plans";
import { getUsage } from "@/lib/usage";
import { SITE_URL } from "@/lib/constants";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const checkoutSchema = z.object({
  productId: z.string().min(1).max(60),
  email: z.string().email(),
  name: z.string().max(120).default(""),
  pageSlug: z.string().default(""),
  visitorId: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("store_checkout", ip), 20);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const product = getProduct(parsed.data.productId);
  if (!product || product.active !== 1) return err.notFound();

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return err.server();
  }

  // Respect tenant contact limit for brand-new buyers (existing contacts always allowed).
  const email = parsed.data.email.toLowerCase();
  const existingContact = row("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", product.tenant_id, email);
  if (!existingContact) {
    const org = row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", product.tenant_id);
    const limits = getLimits(org?.plan ?? "free");
    const used = getUsage(product.tenant_id, "contacts");
    if (limits.contacts !== -1 && used >= limits.contacts) return err.conflict("This creator has reached their contact limit");
  }

  const profile = row<{ username: string }>("SELECT username FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", product.tenant_id);

  const order = createOrderForProduct(product, {
    email,
    name: parsed.data.name,
    pageId: product.page_id,
    visitorId: parsed.data.visitorId,
    source: "store",
  });

  try {
    const session = await provider.createCheckoutSession({
      lines: [{ title: product.name, amountCents: product.price_cents, quantity: 1 }],
      currency: product.currency,
      successUrl: `${SITE_URL}/api/store/checkout/success?order=${order.id}`,
      cancelUrl: `${SITE_URL}/u/${profile?.username ?? ""}`,
      customerEmail: email,
      metadata: { orderId: order.id, tenantId: product.tenant_id },
    });
    attachCheckoutSession(order.id, provider.name, session.sessionId);
    return ok({ url: session.url, orderId: order.id });
  } catch {
    return err.server();
  }
}
