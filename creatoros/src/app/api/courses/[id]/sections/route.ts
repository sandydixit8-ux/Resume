import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row, run, newId, nowIso } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";
import { getCourse } from "@/lib/courses/engine";

const schema = z.object({ title: z.string().min(1).max(160) });

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

  const next = Number(row<{ m: number }>("SELECT COALESCE(MAX(position), -1) + 1 AS m FROM course_sections WHERE course_id = ?", id)?.m ?? 0);
  const sectionId = newId("csec");
  run(
    "INSERT INTO course_sections (id, tenant_id, course_id, title, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    sectionId,
    s.org.id,
    id,
    parsed.data.title,
    next,
    nowIso()
  );
  return ok({ sectionId });
}
