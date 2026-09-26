import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { getLimits } from "@/lib/plans";
import { slugify, uniqueSlug, courseLessonCount } from "@/lib/courses/engine";

const createSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).default(""),
  price_cents: z.number().int().min(0).max(100_000_000).default(0),
  currency: z.enum(["usd", "inr"]).default("usd"),
});

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:read")) return err.forbidden();

  const courses = all<{ id: string; slug: string; title: string; description: string; price_cents: number; currency: string; published: number; created_at: string; updated_at: string }>(
    "SELECT id, slug, title, description, price_cents, currency, published, created_at, updated_at FROM courses WHERE tenant_id = ? ORDER BY created_at DESC",
    s.org.id
  );
  const enriched = courses.map((c) => ({
    ...c,
    lessons: courseLessonCount(c.id),
    students: Number(
      all<{ c: number }>("SELECT COUNT(*) AS c FROM enrollments WHERE course_id = ?", c.id)[0]?.c ?? 0
    ),
  }));
  return ok({ courses: enriched });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "courses:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const limits = getLimits(s.org.plan);
  const count = Number(all<{ c: number }>("SELECT COUNT(*) AS c FROM courses WHERE tenant_id = ?", s.org.id)[0]?.c ?? 0);
  if (limits.courses !== -1 && count >= limits.courses) {
    return err.conflict(`Course limit reached for the ${s.org.plan} plan. Upgrade to create more.`);
  }

  const profile = row<{ id: string }>("SELECT id FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", s.org.id);
  const id = newId("crs");
  const slug = uniqueSlug(s.org.id, slugify(parsed.data.title));
  run(
    `INSERT INTO courses (id, tenant_id, profile_id, slug, title, description, price_cents, currency, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    s.org.id,
    profile?.id ?? null,
    slug,
    parsed.data.title,
    parsed.data.description,
    parsed.data.price_cents,
    parsed.data.currency,
    nowIso(),
    nowIso()
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "courses.create", resource: id });
  return ok({ courseId: id, slug });
}
