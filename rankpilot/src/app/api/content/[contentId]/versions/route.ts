import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, row } from "@/lib/db/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ contentId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { contentId } = await ctx.params;

  const owner = row<{ id: string }>(
    "SELECT id FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    contentId,
    s.org.id
  );
  if (!owner) return err.notFound();

  const items = all(
    `SELECT id, version, title, body, changes, source, status, created_at, approved_at
     FROM content_versions WHERE content_id = ? AND tenant_id = ? ORDER BY version DESC`,
    contentId,
    s.org.id
  );
  return ok({ items });
}
