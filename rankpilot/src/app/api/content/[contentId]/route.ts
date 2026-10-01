import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, run, tx } from "@/lib/db/db";
import { aiCall, isNextResponse } from "@/lib/ai/server";
import { audit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ contentId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { contentId } = await ctx.params;

  const content = (
    await import("@/lib/db/db")
  ).row<Record<string, unknown>>(
    "SELECT * FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    contentId,
    s.org.id
  );
  if (!content) return err.notFound();

  const versions = all(
    `SELECT id, version, title, changes, source, status, created_at, approved_at
     FROM content_versions WHERE content_id = ? AND tenant_id = ? ORDER BY version DESC`,
    contentId,
    s.org.id
  );
  return ok({ content, versions });
}

const patchSchema = z.object({
  status: z.enum(["draft", "review", "approved", "published", "rejected"]).optional(),
  title: z.string().max(300).optional(),
  body: z.string().max(200_000).optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ contentId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const { contentId } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const p = parsed.data;

  const { row } = await import("@/lib/db/db");
  const existing = row<{ title: string; body: string; status: string }>(
    "SELECT title, body, status FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    contentId,
    s.org.id
  );
  if (!existing) return err.notFound();

  const now = nowIso();
  const nextStatus = p.status ?? existing.status;
  const edited = p.body !== undefined || p.title !== undefined;
  const maxV =
    row<{ v: number }>("SELECT COALESCE(MAX(version), 0) AS v FROM content_versions WHERE content_id = ?", contentId)
      ?.v ?? 0;

  tx(() => {
    run(
      `UPDATE content SET title = ?, body = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
      p.title ?? existing.title,
      p.body ?? existing.body,
      nextStatus,
      now,
      contentId,
      s.org.id
    );
    if (edited) {
      const version = maxV + 1;
      const changes: unknown[] = [];
      if (p.title !== undefined && p.title !== existing.title) {
        changes.push({ field: "title", before: existing.title, after: p.title, why: p.note ?? "Manual edit." });
      }
      if (p.body !== undefined && p.body !== existing.body) {
        changes.push({ field: "body", before: `${existing.body.slice(0, 120)}…`, after: `${p.body.slice(0, 120)}…`, why: p.note ?? "Manual edit." });
      }
      run(
        `INSERT INTO content_versions (id, tenant_id, content_id, version, title, body, meta, changes, source, status, created_at, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?, 'manual', ?, ?, ?)`,
        newId("cv"),
        s.org.id,
        contentId,
        version,
        p.title ?? existing.title,
        p.body ?? existing.body,
        JSON.stringify(changes),
        nextStatus === "approved" ? "approved" : "draft",
        now,
        nextStatus === "approved" ? now : null
      );
    } else if (p.status === "approved") {
      run(
        "UPDATE content_versions SET status = 'approved', approved_at = ? WHERE content_id = ? AND tenant_id = ? AND status = 'draft'",
        now,
        contentId,
        s.org.id
      );
    }
  });

  if (p.status && p.status !== existing.status) {
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: `content.${p.status}`,
      entity: "content",
      entityId: contentId,
      meta: { from: existing.status, to: p.status },
    });
  }

  return ok({ contentId, status: nextStatus });
}

const optimizeSchema = z.object({ contentId: z.string().min(1) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ contentId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const { contentId } = await ctx.params;
  const parsed = optimizeSchema.safeParse({ contentId });
  if (!parsed.success) return err.validation(parsed.error.issues);

  const { row } = await import("@/lib/db/db");
  const existing = row<{ title: string; body: string; meta: string; website_id: string }>(
    "SELECT title, body, meta, website_id FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    contentId,
    s.org.id
  );
  if (!existing) return err.notFound();

  const outcome = await aiCall<{ analysis: string; rewritten: string; changes: Array<{ field: string; before: string; after: string; why: string }> }>(
    "content.optimize",
    { websiteId: existing.website_id, contentId, render: { content: { title: existing.title, body: existing.body } } },
    "content:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const now = nowIso();
  const maxV =
    row<{ v: number }>("SELECT COALESCE(MAX(version), 0) AS v FROM content_versions WHERE content_id = ?", contentId)?.v ?? 0;
  const version = maxV + 1;
  const versionId = newId("cv");

  tx(() => {
    run(
      `INSERT INTO content_versions (id, tenant_id, content_id, version, title, body, meta, changes, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      versionId,
      s.org.id,
      contentId,
      version,
      existing.title,
      result.data.rewritten,
      JSON.stringify({ analysis: result.data.analysis }),
      JSON.stringify(result.data.changes),
      result.source,
      now
    );
    run("UPDATE content SET updated_at = ? WHERE id = ? AND tenant_id = ?", now, contentId, s.org.id);
  });

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "content.optimize",
    entity: "content",
    entityId: contentId,
    meta: { versionId, version, source: result.source, changes: result.data.changes.length },
  });

  return ok({
    versionId,
    version,
    source: result.source,
    degraded: result.degraded ?? null,
    analysis: result.data.analysis,
    changes: result.data.changes,
    rewritten: result.data.rewritten,
  });
}
