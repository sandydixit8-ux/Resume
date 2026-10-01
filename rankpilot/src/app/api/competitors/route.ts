import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { getLimits, withinLimit } from "@/lib/plans";
import { auditUrl, FreeAuditError } from "@/lib/audit/free";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  websiteId: z.string().min(1),
  url: z.string().min(4).max(500),
  name: z.string().max(200).default(""),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const items = all(
    `SELECT id, url, name, status, score, overlap_keywords, last_audited_at, created_at
     FROM competitors WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
    websiteId,
    s.org.id
  );
  return ok({ items });
}

/** Add + single-page audit (SSRF-guarded, rules scoring — no AI key needed). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const rl = rateLimit(`competitor:${s.org.id}`, 6, 60_000);
  if (!rl.allowed) return err.rateLimited("Too many competitor audits. Try again in a minute.");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, url, name } = parsed.data;
  const website = getWebsite(s.org.id, websiteId);
  if (!website) return err.notFound();

  const limits = getLimits(s.org.plan);
  const used = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM competitors WHERE website_id = ?",
    websiteId
  )?.n ?? 0;
  if (!withinLimit(used, limits.competitors)) {
    return err.quota("Your plan's competitor limit is reached. Upgrade to add more.");
  }

  const existing = row<{ id: string }>(
    "SELECT id FROM competitors WHERE website_id = ? AND url = ?",
    websiteId,
    url
  );
  if (existing) return err.conflict("That competitor URL is already tracked for this website.");

  const id = newId("cmp");
  const now = nowIso();
  run(
    `INSERT INTO competitors (id, tenant_id, website_id, url, name, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'auditing', ?)`,
    id,
    s.org.id,
    websiteId,
    url,
    name || url,
    now
  );

  try {
    const { page, scored } = await auditUrl({ url });
    const ownKeywords = all<{ term: string }>(
      "SELECT term FROM keywords WHERE website_id = ?",
      websiteId
    ).map((k) => k.term.toLowerCase());
    const ownSet = new Set(ownKeywords);

    // Competitor terms: observed words from their page (title/h1/headings) only.
    const candidates = new Set<string>();
    for (const h of JSON.parse(page.page.headings || "[]") as Array<{ text?: string }>) {
      const t = (h.text ?? "").trim().toLowerCase();
      if (t.length > 2 && t.length < 60) candidates.add(t);
    }
    if (page.page.title) candidates.add(page.page.title.toLowerCase());

    let overlap = 0;
    const gapTerms: Array<{ term: string; inContent: number }> = [];
    tx(() => {
      for (const term of candidates) {
        const inOwn = ownSet.has(term);
        if (inOwn) overlap++;
        else gapTerms.push({ term, inContent: 1 });
        run(
          "INSERT INTO competitor_keywords (id, tenant_id, competitor_id, term, in_content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          newId("ck"),
          s.org.id,
          id,
          term,
          inOwn ? 1 : 0,
          now
        );
      }
      for (const g of gapTerms) {
        run(
          `INSERT INTO content_gaps (id, tenant_id, website_id, term, competitor_id, status, priority, created_at)
           VALUES (?, ?, ?, ?, ?, 'missing', 'medium', ?)
           ON CONFLICT(website_id, term) DO NOTHING`,
          newId("gaps"),
          s.org.id,
          websiteId,
          g.term,
          id,
          now
        );
      }
      run(
        "UPDATE competitors SET status = 'audited', score = ?, overlap_keywords = ?, last_audited_at = ? WHERE id = ?",
        scored.score.overall,
        overlap,
        now,
        id
      );
    });

    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "competitor.audit",
      entity: "competitor",
      entityId: id,
      meta: { websiteId, score: scored.score.overall, overlap, gapsFound: gapTerms.length },
    });

    return ok({
      id,
      status: "audited",
      score: scored.score.overall,
      overlap,
      gapsFound: gapTerms.length,
      measuredAt: now,
      note: "Competitor scores are single-page observed audits, not traffic estimates.",
    });
  } catch (e) {
    run("UPDATE competitors SET status = 'failed' WHERE id = ?", id);
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "competitor.audit_failed",
      entity: "competitor",
      entityId: id,
      meta: { websiteId, reason: e instanceof FreeAuditError ? e.code : "error" },
    });
    if (e instanceof FreeAuditError) {
      return failWith(e.message, e.code);
    }
    throw e;
  }
}

function failWith(message: string, code: string) {
  return Response.json({ ok: false, error: { code, message } }, { status: 422 });
}
