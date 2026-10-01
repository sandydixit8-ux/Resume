import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { newId, nowIso, row, run, tx } from "@/lib/db/db";
import { aiCall, isNextResponse } from "@/lib/ai/server";
import { audit } from "@/lib/audit";

const FORMATS = ["linkedin", "x", "instagram", "newsletter", "script", "blog"] as const;

const schema = z.object({
  contentId: z.string().min(1),
  formats: z.array(z.enum(FORMATS)).min(1).max(4),
});

/** Repurpose approved content into channel assets. Sources are copied, never mutated. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const source = row<{ id: string; title: string; body: string; website_id: string | null; status: string }>(
    "SELECT id, title, body, website_id, status FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    parsed.data.contentId,
    s.org.id
  );
  if (!source) return err.notFound();

  const outcome = await aiCall<{ assets: Array<{ format: string; title: string; body: string }> }>(
    "content.repurpose",
    {
      websiteId: source.website_id ?? undefined,
      contentId: source.id,
      render: { content: { title: source.title, body: source.body }, formats: parsed.data.formats },
    },
    "content:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const now = nowIso();
  const created: string[] = [];
  tx(() => {
    for (const asset of result.data.assets) {
      const id = newId("cnt");
      run(
        `INSERT INTO content (id, tenant_id, website_id, type, title, body, meta, status, channel, source_content_id, created_at, updated_at)
         VALUES (?, ?, ?, 'repurpose', ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        id,
        s.org.id,
        source.website_id,
        asset.title,
        asset.body,
        JSON.stringify({ format: asset.format, promptVersion: result.promptVersion }),
        asset.format,
        source.id,
        now,
        now
      );
      created.push(id);
    }
  });

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "content.repurpose",
    entity: "content",
    entityId: parsed.data.contentId,
    meta: { formats: parsed.data.formats, created: created.length, source: result.source },
  });

  return ok({
    ids: created,
    source: result.source,
    degraded: result.degraded ?? null,
    status: "draft",
    note: "Repurposed assets stay drafts in the Studio until approved.",
  });
}
