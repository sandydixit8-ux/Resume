import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { getLimits } from "@/lib/plans";
import { countProducts } from "@/lib/store/orders";

const productSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  price_cents: z.number().int().min(0).max(100_000_000),
  currency: z.enum(["usd", "inr"]).default("usd"),
  kind: z.enum(["digital", "service", "physical"]).default("digital"),
  media_url: z.string().max(500).default(""),
  page_id: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "store:read")) return err.forbidden();

  const products = all(
    `SELECT id, name, description, price_cents, currency, kind, media_url, page_id, active, created_at, updated_at
     FROM products WHERE tenant_id = ? ORDER BY created_at DESC`,
    s.org.id
  );
  const orders = all(
    `SELECT id, email, status, amount_cents, currency, created_at FROM orders WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50`,
    s.org.id
  );
  return ok({ products, orders });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "store:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const limits = getLimits(s.org.plan);
  if (limits.products !== -1 && countProducts(s.org.id) >= limits.products) {
    return err.conflict(`Product limit reached for the ${s.org.plan} plan. Upgrade to add more.`);
  }

  const id = newId("prd");
  run(
    `INSERT INTO products (id, tenant_id, page_id, name, description, price_cents, currency, kind, media_url, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    s.org.id,
    parsed.data.page_id ?? null,
    parsed.data.name,
    parsed.data.description,
    parsed.data.price_cents,
    parsed.data.currency,
    parsed.data.kind,
    parsed.data.media_url,
    parsed.data.active ? 1 : 0,
    nowIso(),
    nowIso()
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "store.product_create", resource: id });
  return ok({ productId: id });
}
