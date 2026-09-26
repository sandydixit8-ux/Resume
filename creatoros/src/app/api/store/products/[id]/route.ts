import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { run, row } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  price_cents: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.enum(["usd", "inr"]).optional(),
  kind: z.enum(["digital", "service", "physical"]).optional(),
  media_url: z.string().max(500).optional(),
  page_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "store:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM products WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  const d = parsed.data;
  if (d.name !== undefined) { sets.push("name = ?"); values.push(d.name); }
  if (d.description !== undefined) { sets.push("description = ?"); values.push(d.description); }
  if (d.price_cents !== undefined) { sets.push("price_cents = ?"); values.push(d.price_cents); }
  if (d.currency !== undefined) { sets.push("currency = ?"); values.push(d.currency); }
  if (d.kind !== undefined) { sets.push("kind = ?"); values.push(d.kind); }
  if (d.media_url !== undefined) { sets.push("media_url = ?"); values.push(d.media_url); }
  if (d.page_id !== undefined) { sets.push("page_id = ?"); values.push(d.page_id); }
  if (d.active !== undefined) { sets.push("active = ?"); values.push(d.active ? 1 : 0); }
  if (sets.length === 0) return ok({ productId: id });

  sets.push("updated_at = ?");
  values.push(new Date().toISOString(), id, s.org.id);
  run(`UPDATE products SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "store.product_update", resource: id });
  return ok({ productId: id });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "store:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM products WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  run("DELETE FROM products WHERE id = ?", id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "store.product_delete", resource: id });
  return ok({ productId: id });
}
