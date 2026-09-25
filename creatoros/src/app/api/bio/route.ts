import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { getLimits } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const pages = all(
    "SELECT id, slug, title, published, updated_at FROM bio_pages WHERE tenant_id = ? ORDER BY updated_at DESC",
    s.org.id
  );
  const profile = row("SELECT id, username FROM profiles WHERE tenant_id = ? AND user_id = ?", s.org.id, s.user.id);
  return ok({ pages, profile });
}

const createSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{0,50}$/).default(""),
  title: z.string().max(120).default("Untitled page"),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const profile = row<{ id: string }>("SELECT id FROM profiles WHERE tenant_id = ? AND user_id = ?", s.org.id, s.user.id);
  if (!profile) return err.notFound();

  const limits = getLimits(s.org.plan);
  const pageCount = getUsage(s.org.id, "bio_pages");
  if (limits.bioPages !== -1 && pageCount >= limits.bioPages) {
    return err.conflict(`Bio page limit reached for ${s.org.plan} plan. Upgrade to create more.`);
  }

  const dup = row("SELECT id FROM bio_pages WHERE profile_id = ? AND slug = ?", profile.id, parsed.data.slug);
  if (dup) return err.conflict("A page with this slug already exists");

  const pageId = newId("bio");
  run(
    "INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
    pageId,
    s.org.id,
    profile.id,
    parsed.data.slug,
    parsed.data.title,
    nowIso(),
    nowIso()
  );
  bumpUsage(s.org.id, "bio_pages");
  audit({ tenantId: s.org.id, userId: s.user.id, action: "bio.create", resource: pageId, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ pageId });
}