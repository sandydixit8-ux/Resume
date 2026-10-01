import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { aiCall, isNextResponse } from "@/lib/ai/server";

const listSchema = z.object({ websiteId: z.string().optional() });

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const q = listSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return err.validation(q.error.issues);

  const threadId = req.nextUrl.searchParams.get("threadId");
  if (threadId) {
    const thread = row<{ id: string; title: string; website_id: string | null; updated_at: string }>(
      "SELECT id, title, website_id, updated_at FROM copilot_threads WHERE id = ? AND tenant_id = ?",
      threadId,
      s.org.id
    );
    if (!thread) return err.notFound();
    const messages = all(
      "SELECT id, role, content, epistemic, created_at FROM copilot_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 200",
      threadId
    );
    return ok({ thread, messages });
  }

  const where = q.data.websiteId ? "tenant_id = ? AND website_id = ?" : "tenant_id = ?";
  const params = q.data.websiteId ? [s.org.id, q.data.websiteId] : [s.org.id];
  const items = all(
    `SELECT id, title, website_id, updated_at FROM copilot_threads WHERE ${where}
     ORDER BY updated_at DESC LIMIT 50`,
    ...params
  );
  return ok({ items });
}

const createSchema = z.object({
  websiteId: z.string().optional(),
  question: z.string().min(1).max(1000),
  title: z.string().max(200).optional(),
});

/** Ask the copilot. Every answer is split into Observed / Interpretation / Recommendation. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, question, title } = parsed.data;
  if (websiteId && !getWebsite(s.org.id, websiteId)) return err.notFound();

  const outcome = await aiCall<{
    observed: string[];
    interpretation: string;
    recommendation: string;
    missingData: string[];
  }>(
    "copilot.answer",
    { websiteId, render: { question } },
    "content:read"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const now = nowIso();
  const existing = row<{ id: string }>(
    "SELECT id FROM copilot_threads WHERE tenant_id = ? AND title = ? AND (website_id IS ? OR website_id = ?)",
    s.org.id,
    title || question.slice(0, 60),
    websiteId ?? null,
    websiteId ?? null
  );
  const threadId = existing?.id ?? newId("thr");

  tx(() => {
    if (!existing) {
      run(
        "INSERT INTO copilot_threads (id, tenant_id, website_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        threadId,
        s.org.id,
        websiteId ?? null,
        title || question.slice(0, 60),
        now,
        now
      );
    } else {
      run("UPDATE copilot_threads SET updated_at = ? WHERE id = ?", now, threadId);
    }
    run(
      "INSERT INTO copilot_messages (id, thread_id, role, content, epistemic, created_at) VALUES (?, ?, 'user', ?, '{}', ?)",
      newId("msg"),
      threadId,
      question,
      now
    );
    run(
      "INSERT INTO copilot_messages (id, thread_id, role, content, epistemic, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)",
      newId("msg"),
      threadId,
      JSON.stringify({
        observed: result.data.observed,
        interpretation: result.data.interpretation,
        recommendation: result.data.recommendation,
        missingData: result.data.missingData,
      }),
      JSON.stringify({ source: result.source, promptVersion: result.promptVersion, degraded: result.degraded ?? null }),
      now
    );
  });

  return ok({
    threadId,
    answer: result.data,
    source: result.source,
    degraded: result.degraded ?? null,
    note: "Observed items come only from your crawled data. Interpretation and recommendation are AI-generated.",
  });
}
