import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row, run } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";

type Params = { params: Promise<{ sectionId: string }> };

const updateSchema = z.object({ title: z.string().min(1).max(160) });

export async function PUT(req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { sectionId } = await params;

  const owned = row("SELECT id FROM course_sections WHERE id = ? AND tenant_id = ?", sectionId, s.org.id);
  if (!owned) return err.notFound();

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  run("UPDATE course_sections SET title = ? WHERE id = ?", parsed.data.title, sectionId);
  return ok({ sectionId });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();
  const { sectionId } = await params;

  const owned = row("SELECT id FROM course_sections WHERE id = ? AND tenant_id = ?", sectionId, s.org.id);
  if (!owned) return err.notFound();

  run("DELETE FROM course_sections WHERE id = ?", sectionId);
  return ok({ sectionId });
}
