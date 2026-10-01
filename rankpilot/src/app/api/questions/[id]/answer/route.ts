import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { nowIso, row, run } from "@/lib/db/db";
import { aiCall, isNextResponse } from "@/lib/ai/server";
import { audit } from "@/lib/audit";

const schema = z.object({ answer: z.string().max(1000).optional() });

/** AI answer draft for an AEO question. Drafts are never auto-applied — approval is explicit. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const { id } = await ctx.params;

  const q = row<{ id: string; text: string; website_id: string; recommended_answer: string | null }>(
    "SELECT id, text, website_id, recommended_answer FROM questions WHERE id = ? AND tenant_id = ?",
    id,
    s.org.id
  );
  if (!q) return err.notFound();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  // Explicit manual answer short-circuits AI (still validated by guardrails upstream in UI).
  if (parsed.success && parsed.data.answer) {
    run(
      "UPDATE questions SET recommended_answer = ?, schema_type = COALESCE(schema_type, 'FAQPage') WHERE id = ? AND tenant_id = ?",
      parsed.data.answer,
      id,
      s.org.id
    );
    audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "question.answer",
    entity: "question",
    entityId: id,
    meta: { websiteId: q.website_id, source: "manual" },
  });
  return ok({ answer: parsed.data.answer, source: "manual", status: "approved" });
  }

  const outcome = await aiCall<{ answer: string; schemaType: string; rationale: string }>(
    "question.answer",
    { websiteId: q.website_id, render: { question: q.text, questions: [{ text: q.text }] } },
    "content:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  run(
    "UPDATE questions SET recommended_answer = ?, schema_type = COALESCE(schema_type, ?) WHERE id = ? AND tenant_id = ?",
    result.data.answer,
    result.data.schemaType === "None" ? null : result.data.schemaType,
    id,
    s.org.id
  );

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "question.answer",
    entity: "question",
    entityId: id,
    meta: { websiteId: q.website_id, source: result.source, degraded: result.degraded ?? null },
  });

  return ok({
    answer: result.data.answer,
    rationale: result.data.rationale,
    schemaType: result.data.schemaType,
    source: result.source,
    degraded: result.degraded ?? null,
    status: "draft",
    updatedAt: nowIso(),
    note: "Draft only — approve before it appears in generated FAQ schema.",
  });
}
