import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { trackEvent } from "@/lib/analytics/engine";

export interface CourseRow {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  cover_url: string;
  published: number;
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  section_id: string;
  course_id: string;
  title: string;
  type: string;
  content: string;
  duration_min: number;
  position: number;
  published: number;
}

export interface EnrollmentRow {
  id: string;
  tenant_id: string;
  course_id: string;
  contact_id: string | null;
  order_id: string | null;
  email: string;
  source: string;
  completed_at: string | null;
  created_at: string;
}

export function getCourse(courseId: string): CourseRow | undefined {
  return row<CourseRow>("SELECT * FROM courses WHERE id = ?", courseId);
}

export function getCourseBySlug(tenantId: string, slug: string): CourseRow | undefined {
  return row<CourseRow>("SELECT * FROM courses WHERE tenant_id = ? AND slug = ?", tenantId, slug);
}

/** Sections + lessons for a course (instructor sees drafts, students only published). */
export function courseTree(courseId: string, opts: { includeUnpublished: boolean }) {
  const sections = all<{ id: string; title: string; position: number }>(
    "SELECT id, title, position FROM course_sections WHERE course_id = ? ORDER BY position ASC",
    courseId
  );
  const lessonFilter = opts.includeUnpublished ? "" : " AND published = 1";
  const lessons = all<LessonRow>(
    `SELECT id, section_id, course_id, title, type, content, duration_min, position, published FROM lessons WHERE course_id = ?${lessonFilter} ORDER BY position ASC`,
    courseId
  );
  return sections.map((sec) => ({ ...sec, lessons: lessons.filter((l) => l.section_id === sec.id) }));
}

export function courseLessonCount(courseId: string): number {
  return Number(all<{ c: number }>("SELECT COUNT(*) AS c FROM lessons WHERE course_id = ? AND published = 1", courseId)[0]?.c ?? 0);
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "course";
}

export function uniqueSlug(tenantId: string, base: string): string {
  let slug = base;
  let n = 2;
  while (row("SELECT id FROM courses WHERE tenant_id = ? AND slug = ?", tenantId, slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export function enrollmentFor(tenantId: string, courseId: string, email: string): EnrollmentRow | undefined {
  return row<EnrollmentRow>("SELECT * FROM enrollments WHERE tenant_id = ? AND course_id = ? AND email = ?", tenantId, courseId, email.toLowerCase());
}

export function getEnrollment(enrollmentId: string): EnrollmentRow | undefined {
  return row<EnrollmentRow>("SELECT * FROM enrollments WHERE id = ?", enrollmentId);
}

/** Idempotent enrollment (unique per course+email). Returns the enrollment. */
export function ensureEnrollment(
  tenantId: string,
  courseId: string,
  email: string,
  source: "free" | "purchase" | "admin",
  opts: { orderId?: string; contactId?: string | null } = {}
): { enrollment: EnrollmentRow; created: boolean } {
  const normalized = email.toLowerCase();
  const existing = enrollmentFor(tenantId, courseId, normalized);
  if (existing) {
    if (source === "purchase" && !existing.order_id && opts.orderId) {
      run("UPDATE enrollments SET order_id = ? WHERE id = ?", opts.orderId, existing.id);
    }
    return { enrollment: getEnrollment(existing.id)!, created: false };
  }
  const id = newId("enr");
  run(
    "INSERT INTO enrollments (id, tenant_id, course_id, contact_id, order_id, email, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    tenantId,
    courseId,
    opts.contactId ?? null,
    opts.orderId ?? null,
    normalized,
    source,
    nowIso()
  );
  trackEvent({ tenantId, eventType: "course_started", ref: "courses" });
  return { enrollment: getEnrollment(id)!, created: true };
}

export function progressFor(enrollmentId: string): Array<{ lesson_id: string; completed: number; score: number }> {
  return all("SELECT lesson_id, completed, score FROM lesson_progress WHERE enrollment_id = ?", enrollmentId);
}

export function enrollmentProgress(enrollmentId: string, courseId: string): { completed: number; total: number; pct: number } {
  const total = courseLessonCount(courseId);
  const completed = Number(
    all<{ c: number }>("SELECT COUNT(*) AS c FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.enrollment_id = ? AND lp.completed = 1 AND l.published = 1", enrollmentId)[0]?.c ?? 0
  );
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
}

/** Upsert lesson progress; when the course is fully complete, stamp completed_at once. */
export function markLessonProgress(
  enrollment: EnrollmentRow,
  lessonId: string,
  input: { completed: boolean; score?: number }
): { done: boolean; courseCompleted: boolean } {
  const existing = row<{ id: string }>("SELECT id FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ?", enrollment.id, lessonId);
  if (existing) {
    run(
      "UPDATE lesson_progress SET completed = ?, score = ?, updated_at = ? WHERE id = ?",
      input.completed ? 1 : 0,
      input.score ?? -1,
      nowIso(),
      existing.id
    );
  } else {
    run(
      "INSERT INTO lesson_progress (id, tenant_id, enrollment_id, lesson_id, completed, score, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      newId("lpr"),
      enrollment.tenant_id,
      enrollment.id,
      lessonId,
      input.completed ? 1 : 0,
      input.score ?? -1,
      nowIso()
    );
  }

  let courseCompleted = false;
  if (input.completed) {
    const freshest = getEnrollment(enrollment.id);
    if (freshest && !freshest.completed_at) {
      const { completed, total } = enrollmentProgress(enrollment.id, enrollment.course_id);
      if (total > 0 && completed >= total) {
        run("UPDATE enrollments SET completed_at = ? WHERE id = ? AND completed_at IS NULL", nowIso(), enrollment.id);
        trackEvent({ tenantId: enrollment.tenant_id, eventType: "course_completed", ref: "courses" });
        courseCompleted = true;
      }
    }
  }
  return { done: input.completed, courseCompleted };
}

/** Access check: an enrollment belongs to the buyer's email; sessions carry the same email. */
export function canAccessEnrollment(enrollment: EnrollmentRow, sessionEmail: string | undefined): boolean {
  if (!sessionEmail) return false;
  return enrollment.email.toLowerCase() === sessionEmail.toLowerCase();
}
