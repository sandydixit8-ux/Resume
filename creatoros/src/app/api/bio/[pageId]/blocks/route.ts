import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, row, run, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const updateSchema = z.object({
  blocks: z
    .array(
      z.object({
        id: z.string().min(1),
        position: z.number().int().min(0),
        payload: z.record(z.string(), z.unknown()).optional(),
        active: z.boolean().optional(),
      })
    )
    .max(200),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "bio:write")) return err.forbidden();
  const { pageId } = await ctx.params;

  const page = row<{ id: string }>("SELECT id FROM bio_pages WHERE id = ? AND tenant_id = ?", pageId, s.org.id);
  if (!page) return err.notFound();

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  // Tenant & page ownership check for each block id to prevent cross-tenant writes
  const validIds = new Set(
    all<{ id: string }>("SELECT id FROM bio_blocks WHERE page_id = ? AND tenant_id = ?", pageId, s.org.id).map((b) => b.id)
  );

  let changed = 0;
  for (const b of parsed.data.blocks) {
    if (!validIds.has(b.id)) continue;
    if (b.payload !== undefined) {
      run("UPDATE bio_blocks SET payload = ?, position = ?, updated_at = ? WHERE id = ?", JSON.stringify(b.payload), b.position, nowIso(), b.id);
    } else {
      run("UPDATE bio_blocks SET position = ?, updated_at = ? WHERE id = ?", b.position, nowIso(), b.id);
    }
    if (b.active !== undefined) {
      run("UPDATE bio_blocks SET active = ?, updated_at = ? WHERE id = ?", b.active ? 1 : 0, nowIso(), b.id);
    }
    changed++;
  }

  audit({ tenantId: s.org.id, userId: s.user.id, action: "bio.blocks_update", resource: pageId, meta: { changed }, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ changed });
}