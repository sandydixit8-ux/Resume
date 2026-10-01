import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { normalizeWebsiteUrl, UrlError } from "@/lib/url";
import { countWebsites, listWebsites } from "@/lib/websites/repo";
import { getLimits, withinLimit } from "@/lib/plans";
import { newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

export const createSchema = z.object({
  url: z.string().min(1).max(500),
  name: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  audience: z.string().trim().max(300).optional(),
  products: z.string().trim().max(500).optional(),
  primaryKeywords: z.string().trim().max(500).optional(),
  targetMarket: z.string().trim().max(200).optional(),
  competitors: z.array(z.string().max(300)).max(10).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  return ok({ websites: listWebsites(s.org.id) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();

  const ip = getClientIp(req);
  const rl = rateLimit(`site:create:${s.org.id}`, 20, 60_000);
  if (!rl.allowed) return err.rateLimited();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const limits = getLimits(s.org.plan);
  if (!withinLimit(countWebsites(s.org.id), limits.websites)) {
    return err.quota("Your plan's website limit has been reached. Upgrade to add more.");
  }

  let normalized;
  try {
    normalized = normalizeWebsiteUrl(parsed.data.url);
  } catch (e) {
    if (e instanceof UrlError) return err.validation([{ message: e.message, path: ["url"] }]);
    throw e;
  }

  const dup = row<{ id: string }>(
    "SELECT id FROM websites WHERE tenant_id = ? AND normalized_url = ? AND deleted_at IS NULL",
    s.org.id,
    normalized.normalized
  );
  if (dup) return err.conflict("This website is already in your workspace.");

  const id = newId("ws");
  const now = nowIso();
  const token = `rankpilot-${id.slice(3, 15)}`;
  run(
    `INSERT INTO websites (id, tenant_id, name, url, normalized_url, verification_token, industry, country,
       audience, products, primary_keywords, target_market, competitor_urls, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    s.org.id,
    parsed.data.name?.trim() || hostLabel(normalized.normalized),
    normalized.normalized,
    normalized.normalized,
    token,
    parsed.data.industry ?? null,
    parsed.data.country ?? null,
    parsed.data.audience ?? null,
    parsed.data.products ?? null,
    parsed.data.primaryKeywords ?? null,
    parsed.data.targetMarket ?? null,
    JSON.stringify(parsed.data.competitors ?? []),
    now,
    now
  );
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "website.create",
    entity: "website",
    entityId: id,
    ip,
  });

  const created = row("SELECT * FROM websites WHERE id = ? AND tenant_id = ?", id, s.org.id);
  return ok({ website: created });
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Website";
  }
}
