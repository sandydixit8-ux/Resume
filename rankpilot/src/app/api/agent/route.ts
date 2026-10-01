import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { aiCall, isNextResponse } from "@/lib/ai/server";
import { audit } from "@/lib/audit";

/** Today's priorities + autonomous opportunity discovery, grounded in crawl context. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = z.object({ websiteId: z.string().min(1).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId } = parsed.data;
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const outcome = await aiCall<{
    priorities: Array<{ title: string; why: string; effort: string; impact: string; basedOn: string }>;
  }>(
    "agent.priorities",
    { websiteId },
    "actions:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const today = new Date().toISOString().slice(0, 10);
  const existing = row<{ id: string }>(
    "SELECT id FROM agent_runs WHERE tenant_id = ? AND run_date = ?",
    s.org.id,
    today
  );
  const id = existing?.id ?? newId("agt");
  const opportunities = all<{ id: string; title: string; severity: string }>(
    `SELECT id, title, severity FROM seo_issues
     WHERE website_id = ? AND status = 'new' AND severity IN ('critical','high')
     ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END LIMIT 5`,
    websiteId
  ).map((i) => ({ title: i.title, severity: i.severity }));

  const summary = result.data.priorities.length
    ? `${result.data.priorities.length} prioritised action(s) based on observed crawl data.`
    : "No open critical/high issues — nothing urgent today.";

  if (existing) {
    run(
      "UPDATE agent_runs SET summary = ?, priorities = ?, opportunities = ? WHERE id = ?",
      summary,
      JSON.stringify(result.data.priorities),
      JSON.stringify(opportunities),
      id
    );
  } else {
    run(
      "INSERT INTO agent_runs (id, tenant_id, run_date, summary, priorities, opportunities, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      s.org.id,
      today,
      summary,
      JSON.stringify(result.data.priorities),
      JSON.stringify(opportunities),
      nowIso()
    );
  }

  // Promote top priority into the Action Center so the loop closes.
  const top = result.data.priorities[0];
  if (top) {
    run(
      `INSERT INTO actions (id, tenant_id, website_id, title, description, priority, impact, effort, status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'agent', ?, ?)`,
      newId("act"),
      s.org.id,
      websiteId,
      top.title.slice(0, 200),
      `${top.why}\n\nBasis: ${top.basedOn}`,
      top.impact === "high" ? "high" : "medium",
      top.impact,
      top.effort,
      nowIso(),
      nowIso()
    );
  }

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "agent.run",
    entity: "agent_run",
    entityId: id,
    meta: { websiteId, priorities: result.data.priorities.length, source: result.source },
  });

  return ok({
    runId: id,
    summary,
    priorities: result.data.priorities,
    opportunities,
    source: result.source,
    degraded: result.degraded ?? null,
    note: "Priorities derive only from observed crawl data; no outcomes are predicted.",
  });
}

/** GET — latest agent run for the tenant (optionally per website). */
export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  const r = row<{ id: string; run_date: string; summary: string; priorities: string; opportunities: string; created_at: string }>(
    "SELECT id, run_date, summary, priorities, opportunities, created_at FROM agent_runs WHERE tenant_id = ? ORDER BY run_date DESC, created_at DESC LIMIT 1",
    s.org.id
  );
  if (!r) return ok({ run: null });
  return ok({
    run: {
      id: r.id,
      date: r.run_date,
      summary: r.summary,
      priorities: JSON.parse(r.priorities || "[]"),
      opportunities: JSON.parse(r.opportunities || "[]"),
      createdAt: r.created_at,
    },
  });
}
