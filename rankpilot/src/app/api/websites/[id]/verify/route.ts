import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { fetchText } from "@/lib/crawler/fetcher";
import { nowIso, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;
  const website = getWebsite(s.org.id, id);
  if (!website) return err.notFound();

  const token = website.verification_token ?? `rankpilot-${id.slice(3, 15)}`;
  return ok({
    token,
    metaTag: `<meta name="rankpilot-verification" content="${token}" />`,
    instructions:
      'Place the meta tag inside the <head> of your homepage, then press "Verify". Verification is optional — crawling works either way.',
    verified: Boolean(website.verified_at),
  });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "crawl:run")) return err.forbidden();
  const { id } = await ctx.params;
  const website = getWebsite(s.org.id, id);
  if (!website) return err.notFound();

  const token = website.verification_token ?? `rankpilot-${id.slice(3, 15)}`;
  try {
    const res = await fetchText(website.normalized_url);
    const found = res.text.toLowerCase().includes(token.toLowerCase());
    if (found) {
      run("UPDATE websites SET verified_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?", nowIso(), nowIso(), id, s.org.id);
      audit({
        tenantId: s.org.id,
        userId: s.user.id,
        action: "website.verify",
        entity: "website",
        entityId: id,
        meta: { verified: true },
      });
      return ok({ verified: true });
    }
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "website.verify",
      entity: "website",
      entityId: id,
      meta: { verified: false, reason: "tag_not_found" },
    });
    return ok({ verified: false, reason: "Verification tag not found on the homepage yet." });
  } catch (e) {
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "website.verify",
      entity: "website",
      entityId: id,
      meta: { verified: false, reason: "fetch_failed" },
    });
    return ok({
      verified: false,
      reason: `Could not fetch the website: ${e instanceof Error ? e.message : "network error"}`,
    });
  }
}
