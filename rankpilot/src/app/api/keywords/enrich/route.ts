import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { all, nowIso, row } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";

/**
 * Keyword enrichment: pulls volume/difficulty only when a provider key is configured.
 * Without one we return explicit `unavailable` entries — never invented numbers.
 */
const schema = z.object({ websiteId: z.string().min(1), limit: z.number().int().min(1).max(50).default(20) });

interface ProviderRow {
  id: string;
  term: string;
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const rl = rateLimit(`enrich:${s.org.id}`, 10, 60_000);
  if (!rl.allowed) return err.rateLimited("Enrichment limit reached. Try again in a minute.");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, limit } = parsed.data;
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const apiKey = process.env.KEYDATA_API_KEY;
  const rows = all<ProviderRow>(
    "SELECT id, term FROM keywords WHERE website_id = ? AND tenant_id = ? ORDER BY occurrences DESC LIMIT ?",
    websiteId,
    s.org.id,
    limit
  );

  if (!apiKey) {
    return ok({
      enriched: 0,
      total: rows.length,
      provider: null,
      status: "unavailable",
      note: "No keyword data provider configured (KEYDATA_API_KEY). Volumes stay 'Data unavailable'.",
      sample: rows.slice(0, 5).map((r) => ({ term: r.term, volume: null, difficulty: null, source: "unavailable" })),
    });
  }

  // Provider integration point. Until a real provider is wired, we never fabricate values.
  return ok({
    enriched: 0,
    total: rows.length,
    provider: "keydata",
    status: "unavailable",
    note: "Provider key present but no provider client implemented yet — volumes remain 'Data unavailable'.",
    sample: rows.slice(0, 5).map((r) => ({ term: r.term, volume: null, difficulty: null, source: "unavailable" })),
  });
}

/** GET — current enrichment state for the website's keywords. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const total = row<{ n: number; withVolume: number }>(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN volume IS NOT NULL THEN 1 ELSE 0 END) AS withVolume
     FROM keywords WHERE website_id = ? AND tenant_id = ?`,
    websiteId,
    s.org.id
  );
  return ok({
    total: total?.n ?? 0,
    withVolume: total?.withVolume ?? 0,
    providerConfigured: Boolean(process.env.KEYDATA_API_KEY),
    note: "Keywords without provider data show 'Data unavailable'.",
    updatedAt: nowIso(),
  });
}
