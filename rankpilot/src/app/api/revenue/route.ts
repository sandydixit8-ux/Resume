import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";

/** Revenue attribution: manually recorded events attributed to tracked channels. */
const createSchema = z.object({
  websiteId: z.string().nullable().default(null),
  source: z.enum(["organic", "ai_search", "social", "referral", "email", "direct", "manual"]).default("manual"),
  label: z.string().min(1).max(200),
  amountUsd: z.number().min(0).max(1_000_000),
  occurredAt: z.string().min(4),
});

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  const items = all(
    `SELECT id, website_id, source, label, amount_usd, occurred_at, created_at
     FROM revenue_events WHERE tenant_id = ? ORDER BY occurred_at DESC LIMIT 100`,
    s.org.id
  );
  const totals = row<{ total: number | null; n: number }>(
    "SELECT SUM(amount_usd) AS total, COUNT(*) AS n FROM revenue_events WHERE tenant_id = ?",
    s.org.id
  );
  return ok({ items, totalUsd: Number((totals?.total ?? 0).toFixed(2)), count: totals?.n ?? 0 });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "settings:write")) return err.forbidden();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;

  if (d.websiteId) {
    const site = row<{ id: string }>(
      "SELECT id FROM websites WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
      d.websiteId,
      s.org.id
    );
    if (!site) return err.notFound();
  }

  const id = newId("rev");
  run(
    "INSERT INTO revenue_events (id, tenant_id, website_id, source, label, amount_usd, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    s.org.id,
    d.websiteId,
    d.source,
    d.label,
    d.amountUsd,
    d.occurredAt,
    nowIso()
  );
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "revenue.create",
    entity: "revenue_event",
    entityId: id,
    meta: { source: d.source, amountUsd: d.amountUsd, websiteId: d.websiteId },
  });
  return ok({ id });
}

const delSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "settings:write")) return err.forbidden();
  const parsed = delSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const res = run("DELETE FROM revenue_events WHERE id = ? AND tenant_id = ?", parsed.data.id, s.org.id);
  if (res.changes !== 1) return err.notFound();
  audit({ tenantId: s.org.id, userId: s.user.id, action: "revenue.delete", entity: "revenue_event", entityId: parsed.data.id });
  return ok({ id: parsed.data.id, deleted: true });
}
