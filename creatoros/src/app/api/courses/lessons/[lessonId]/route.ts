import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row, run, nowIso } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";

type Params = { params: Promise<{ lessonId: string }> };

const updateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  type: z.enum(["video", "audio", "pdf", "text", "quiz", "external"]).optional(),
  content: z.string().max(20000).optional(),
  duration_min: z.number().int().min(0).max(10000).optional(),
  published: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { lessonId } = await params;

  const owned = row("SELECT id FROM lessons WHERE id = ? AND tenant_id = ?", lessonId, s.org.id);
  if (!owned) return err.notFound();

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const d = parsed.data;
  if (d.type === "quiz" && d.content !== undefined) {
    try {
      const q = JSON.parse(d.content) as { question?: string };
      if (!q || typeof q.question !== "string") throw new Error("bad quiz");
    } catch {
      return err.validation({ content: "Quiz must be a JSON object with a question and options" });
    }
  }

  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (d.title !== undefined) { sets.push("title = ?"); values.push(d.title); }
  if (d.type !== undefined) { sets.push("type = ?"); values.push(d.type); }
  if (d.content !== undefined) { sets.push("content = ?"); values.push(d.content); }
  if (d.duration_min !== undefined) { sets.push("duration_min = ?"); values.push(d.duration_min); }
  if (d.published !== undefined) { sets.push("published = ?"); values.push(d.published ? 1 : 0); }
  if (sets.length === 0) return ok({ lessonId });

  sets.push("updated_at = ?");
  values.push(nowIso(), lessonId);
  run(`UPDATE lessons SET ${sets.join(", ")} WHERE id = ?`, ...values);
  return ok({ lessonId });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { lessonId } = await params;

  const owned = row("SELECT id FROM lessons WHERE id = ? AND tenant_id = ?", lessonId, s.org.id);
  if (!owned) return err.notFound();

  run("DELETE FROM lessons WHERE id = ?", lessonId);
  return ok({ lessonId });
}
