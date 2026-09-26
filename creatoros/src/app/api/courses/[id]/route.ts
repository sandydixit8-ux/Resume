import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { getCourse, courseTree, courseLessonCount, type CourseRow } from "@/lib/courses/engine";

type Params = { params: Promise<{ id: string }> };

function ownedCourse(tenantId: string, id: string): CourseRow | undefined {
  const course = getCourse(id);
  if (!course || course.tenant_id !== tenantId) return undefined;
  return course;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:read")) return err.forbidden();
  const { id } = await params;

  const course = ownedCourse(s.org.id, id);
  if (!course) return err.notFound();

  const tree = courseTree(id, { includeUnpublished: true });
  const students = Number(row<{ c: number }>("SELECT COUNT(*) AS c FROM enrollments WHERE course_id = ?", id)?.c ?? 0);
  return ok({ course, sections: tree, students, lessons: courseLessonCount(id) });
}

const updateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  price_cents: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.enum(["usd", "inr"]).optional(),
  cover_url: z.string().max(500).optional(),
  published: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { id } = await params;

  const course = ownedCourse(s.org.id, id);
  if (!course) return err.notFound();

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const d = parsed.data;
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (d.title !== undefined) { sets.push("title = ?"); values.push(d.title); }
  if (d.description !== undefined) { sets.push("description = ?"); values.push(d.description); }
  if (d.price_cents !== undefined) { sets.push("price_cents = ?"); values.push(d.price_cents); }
  if (d.currency !== undefined) { sets.push("currency = ?"); values.push(d.currency); }
  if (d.cover_url !== undefined) { sets.push("cover_url = ?"); values.push(d.cover_url); }
  if (d.published !== undefined) { sets.push("published = ?"); values.push(d.published ? 1 : 0); }
  if (sets.length === 0) return ok({ courseId: id });

  sets.push("updated_at = ?");
  values.push(new Date().toISOString(), id);
  run(`UPDATE courses SET ${sets.join(", ")} WHERE id = ?`, ...values);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "courses.update", resource: id });
  return ok({ courseId: id });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { id } = await params;

  const course = ownedCourse(s.org.id, id);
  if (!course) return err.notFound();

  run("DELETE FROM courses WHERE id = ?", id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "courses.delete", resource: id });
  return ok({ courseId: id });
}
