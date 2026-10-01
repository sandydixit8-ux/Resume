import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";

const FREQ = ["daily", "weekly", "monthly"] as const;
const INTERVAL_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const putSchema = z.object({
  websiteId: z.string().min(1),
  frequency: z.enum(FREQ).nullable(),
});

/** GET schedule for a website (or unset). */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();
  const r = row<{ id: string; frequency: string; enabled: number; next_run_at: string | null; last_run_at: string | null }>(
    "SELECT id, frequency, enabled, next_run_at, last_run_at FROM crawl_schedules WHERE website_id = ? AND tenant_id = ?",
    websiteId,
    s.org.id
  );
  return ok({ schedule: r ?? null });
}

/** PUT — set or clear (frequency=null) a schedule. */
export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "crawl:run")) return err.forbidden();
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, frequency } = parsed.data;
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const existing = row<{ id: string }>(
    "SELECT id FROM crawl_schedules WHERE website_id = ? AND tenant_id = ?",
    websiteId,
    s.org.id
  );

  if (!frequency) {
    if (existing) run("DELETE FROM crawl_schedules WHERE id = ?", existing.id);
    run("UPDATE websites SET crawl_schedule = NULL WHERE id = ? AND tenant_id = ?", websiteId, s.org.id);
    return ok({ schedule: null });
  }

  const next = new Date(Date.now() + INTERVAL_MS[frequency]).toISOString();
  const now = nowIso();
  if (existing) {
    run(
      "UPDATE crawl_schedules SET frequency = ?, enabled = 1, next_run_at = ? WHERE id = ?",
      frequency,
      next,
      existing.id
    );
  } else {
    run(
      "INSERT INTO crawl_schedules (id, tenant_id, website_id, frequency, enabled, next_run_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      newId("sch"),
      s.org.id,
      websiteId,
      frequency,
      next,
      now
    );
  }
  run("UPDATE websites SET crawl_schedule = ?, updated_at = ? WHERE id = ? AND tenant_id = ?", frequency, now, websiteId, s.org.id);

  audit({ tenantId: s.org.id, userId: s.user.id, action: "crawl.schedule_set", entity: "website", entityId: websiteId, meta: { frequency } });
  return ok({ schedule: { frequency, next_run_at: next, enabled: 1 } });
}
