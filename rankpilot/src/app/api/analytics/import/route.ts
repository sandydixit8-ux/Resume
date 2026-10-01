import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { all, row } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { can } from "@/lib/auth/rbac";
import { gscConfig } from "@/lib/search-console/gsc";
import { syncSearchConsole } from "@/lib/search-console/sync";
import { audit } from "@/lib/audit";

/**
 * Analytics import (GSC/GA4/Bing). Without credentials we report unavailable
 * rows explicitly — never synthetic click/CTR numbers.
 */
const schema = z.object({ websiteId: z.string().min(1), source: z.enum(["gsc", "ga4", "bing"]).default("gsc") });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  // Guard now, while this endpoint is still read-only: the moment a real
  // importer writes rows it must not be reachable by read-only roles.
  if (!can(s.role, "settings:write")) return err.forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const rl = rateLimit(`analytics:${s.org.id}`, 10, 60_000);
  if (!rl.allowed) return err.rateLimited("Import limit reached. Try again in a minute.");
  if (!getWebsite(s.org.id, parsed.data.websiteId)) return err.notFound();

  const connected = row<{ provider: string }>(
    "SELECT provider FROM integrations WHERE tenant_id = ? AND status = 'connected' AND provider = ?",
    s.org.id,
    parsed.data.source === "gsc" ? "search_console" : parsed.data.source === "ga4" ? "analytics" : "serp"
  );

  if (!connected) {
    return ok({
      source: parsed.data.source,
      status: "unavailable",
      imported: 0,
      rows: [],
      note: "No analytics integration connected — metrics stay 'Data unavailable' rather than estimated.",
    });
  }

  if (parsed.data.source === "gsc") {
    const cfg = gscConfig();
    if ("problem" in cfg) {
      return ok({
        source: "gsc",
        status: "unavailable",
        imported: 0,
        rows: [],
        note: cfg.problem,
      });
    }
    try {
      const result = await syncSearchConsole({
        tenantId: s.org.id,
        websiteId: parsed.data.websiteId,
        config: cfg.config,
      });
      if (result.problem === "no_access") {
        return ok({
          source: "gsc",
          status: "unavailable",
          imported: 0,
          rows: [],
          note: "The Search Console service account has no access to this property — add it in Search Console, then re-sync.",
        });
      }
      if (!result.ok) {
        return ok({
          source: "gsc",
          status: "unavailable",
          imported: 0,
          rows: [],
          note: "Search Console sync could not run.",
        });
      }
      audit({
        tenantId: s.org.id,
        userId: s.user.id,
        action: "analytics.imported",
        entity: "website",
        entityId: parsed.data.websiteId,
        meta: { source: "gsc", imported: result.imported, window: result.window },
      });
      return ok({
        source: "gsc",
        status: "synced",
        imported: result.imported,
        rows: [],
        window: result.window,
        deadlineDays: result.deadlineDays,
        note:
          result.imported === 0
            ? "No query data in the window (recent days are reserved for GSC's own processing deadline)."
            : undefined,
      });    } catch (e) {
      return ok({
        source: "gsc",
        status: "unavailable",
        imported: 0,
        rows: [],
        note: e instanceof Error ? e.message : "Search Console sync failed.",
      });
    }
  }

  return ok({
    source: parsed.data.source,
    status: "unavailable",
    imported: 0,
    rows: [],
    note: "Integration marked connected, but no importer client is implemented in this build.",
  });
}

/** GET — observed keyword rows with their CTR/rank fields (null = unavailable). */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const rows = all<{ term: string; volume: number | null; current_rank: number | null; ctr: number | null }>(
    "SELECT term, volume, current_rank, ctr FROM keywords WHERE website_id = ? AND tenant_id = ? LIMIT 50",
    websiteId,
    s.org.id
  );
  const withCtr = rows.filter((r) => r.ctr !== null).length;
  return ok({
    rows,
    sources: { withCtr, total: rows.length },
    note: withCtr === 0 ? "No CTR data imported yet — Data unavailable." : undefined,
  });
}
