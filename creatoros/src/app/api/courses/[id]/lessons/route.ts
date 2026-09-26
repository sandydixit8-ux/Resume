import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row, run, newId, nowIso } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";
import { getCourse } from "@/lib/courses/engine";

const schema = z.object({
  sectionId: z.string().min(1).max(60),
  title: z.string().min(1).max(160),
  type: z.enum(["video", "audio", "pdf", "text", "quiz", "external"]).default("text"),
  content: z.string().max(20000).default(""),
  duration_min: z.number().int().min(0).max(10000).default(0),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { id } = await params;

  const course = getCourse(id);
  if (!course || course.tenant_id !== s.org.id) return err.notFound();

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const section = row("SELECT id FROM course_sections WHERE id = ? AND course_id = ?", parsed.data.sectionId, id);
  if (!section) return err.notFound();

  if (parsed.data.type === "quiz") {
    try {
      const q = JSON.parse(parsed.data.content) as { question?: string };
      if (!q || typeof q.question !== "string") throw new Error("bad quiz");
    } catch {
      return err.validation({ content: "Quiz must be a JSON object with a question and options" });
    }
  }

  const next = Number(row<{ m: number }>("SELECT COALESCE(MAX(position), -1) + 1 AS m FROM lessons WHERE course_id = ?", id)?.m ?? 0);
  const lessonId = newId("les");
  run(
    `INSERT INTO lessons (id, tenant_id, course_id, section_id, title, type, content, duration_min, position, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    lessonId,
    s.org.id,
    id,
    parsed.data.sectionId,
    parsed.data.title,
    parsed.data.type,
    parsed.data.content,
    parsed.data.duration_min,
    next,
    nowIso(),
    nowIso()
  );
  return ok({ lessonId });
}
