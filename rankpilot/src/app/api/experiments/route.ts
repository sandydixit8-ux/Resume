import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  websiteId: z.string().min(1),
  name: z.string().min(1).max(200),
  hypothesis: z.string().max(600).default(""),
  metric: z.enum(["ctr", "rank", "clicks", "conversions"]).default("ctr"),
  variants: z
    .array(z.object({ label: z.string().min(1).max(80), trafficPct: z.number().int().min(0).max(100).default(50), contentId: z.string().optional() }))
    .min(2)
    .max(4),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const experiments = all<{ id: string; name: string; hypothesis: string; metric: string; status: string; created_at: string }>(
    "SELECT id, name, hypothesis, metric, status, created_at FROM experiments WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    websiteId,
    s.org.id
  );
  const variants = all<{ id: string; experiment_id: string; label: string; traffic_pct: number; result_value: number | null }>(
    `SELECT v.id, v.experiment_id, v.label, v.traffic_pct, v.result_value
     FROM experiment_variants v JOIN experiments e ON e.id = v.experiment_id
     WHERE e.website_id = ? AND e.tenant_id = ?`,
    websiteId,
    s.org.id
  );
  return ok({ items: experiments, variants });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;
  if (!getWebsite(s.org.id, d.websiteId)) return err.notFound();

  const id = newId("exp");
  const now = nowIso();
  tx(() => {
    run(
      "INSERT INTO experiments (id, tenant_id, website_id, name, hypothesis, metric, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)",
      id,
      s.org.id,
      d.websiteId,
      d.name,
      d.hypothesis,
      d.metric,
      now
    );
    for (const v of d.variants) {
      run(
        "INSERT INTO experiment_variants (id, experiment_id, label, content_id, payload, traffic_pct, created_at) VALUES (?, ?, ?, ?, '{}', ?, ?)",
        newId("var"),
        id,
        v.label,
        v.contentId ?? null,
        v.trafficPct,
        now
      );
    }
  });
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "experiment.create",
    entity: "experiment",
    entityId: id,
    meta: { websiteId: d.websiteId, metric: d.metric, variants: d.variants.length },
  });
  return ok({ id, status: "draft" });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["draft", "running", "paused", "concluded"]),
});

/** Variant results are entered manually from your analytics — never auto-invented. */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const body = await req.json().catch(() => null);

  const resultSchema = z.object({ variantId: z.string(), resultValue: z.number().nullable() });
  const r = resultSchema.safeParse(body);
  if (r.success) {
    const res = run(
      "UPDATE experiment_variants SET result_value = ? WHERE id = ? AND experiment_id IN (SELECT id FROM experiments WHERE tenant_id = ?)",
      r.data.resultValue,
      r.data.variantId,
      s.org.id
    );
    if (res.changes !== 1) return err.notFound();
    return ok({ id: r.data.variantId, resultValue: r.data.resultValue });
  }

  const p = patchSchema.safeParse(body);
  if (!p.success) return err.validation(p.error.issues);
  const owned = row<{ id: string }>(
    "SELECT id FROM experiments WHERE id = ? AND tenant_id = ?",
    p.data.id,
    s.org.id
  );
  if (!owned) return err.notFound();
  run("UPDATE experiments SET status = ? WHERE id = ?", p.data.status, p.data.id);
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: `experiment.${p.data.status}`,
    entity: "experiment",
    entityId: p.data.id,
  });
  return ok({ id: p.data.id, status: p.data.status });
}
