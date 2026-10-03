import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import {
  getCourse,
  getCourseBySlug,
  courseTree,
  courseLessonCount,
  ensureEnrollment,
  enrollmentFor,
  enrollmentProgress,
  markLessonProgress,
  canAccessEnrollment,
  type EnrollmentRow,
} from "./engine";

let dir: string;
const TENANT = "org_course_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-course-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Course Test', 'test-course-org', 'creator', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function seedCourseMinimal(): string {
  const id = newId("crs");
  run(
    "INSERT INTO courses (id, tenant_id, profile_id, slug, title, description, price_cents, currency, published, created_at, updated_at) VALUES (?, ?, NULL, ?, 'Test Course', 'desc', 0, 'usd', 1, ?, ?)",
    id,
    TENANT,
    "test-course-" + id.slice(4),
    nowIso(),
    nowIso()
  );
  return id;
}

function seedSection(courseId: string, title: string, position: number): string {
  const id = newId("sec");
  run(
    "INSERT INTO course_sections (id, tenant_id, course_id, title, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    TENANT,
    courseId,
    title,
    position,
    nowIso()
  );
  return id;
}

function seedLesson(sectionId: string, courseId: string, opts: { title?: string; position?: number; published?: number } = {}): string {
  const id = newId("les");
  run(
    "INSERT INTO lessons (id, tenant_id, section_id, course_id, title, type, content, duration_min, position, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'video', 'https://example.com/v.mp4', 10, ?, ?, ?, ?)",
    id,
    TENANT,
    sectionId,
    courseId,
    opts.title ?? "Lesson",
    opts.position ?? 0,
    opts.published ?? 1,
    nowIso(),
    nowIso()
  );
  return id;
}

describe("course engine", () => {
  it("creates a course and finds it by slug", () => {
    const id = seedCourseMinimal();
    expect(getCourse(id)?.slug).toContain("test-course-");
    expect(getCourseBySlug(TENANT, getCourse(id)!.slug)?.id).toBe(id);
  });

  it("tracks enrollment idempotently with source", () => {
    const courseId = seedCourseMinimal();
    const first = ensureEnrollment(TENANT, courseId, "Student@Example.com", "free");
    expect(first.created).toBe(true);
    expect(first.enrollment.email).toBe("student@example.com");
    const second = ensureEnrollment(TENANT, courseId, "student@example.com", "free");
    expect(second.created).toBe(false);
    expect(second.enrollment.id).toBe(first.enrollment.id);
    expect(row<{ source: string }>("SELECT source FROM enrollments WHERE id = ?", first.enrollment.id)?.source).toBe("free");
  });

  it("progresses through lessons and completes the course once", () => {
    const courseId = seedCourseMinimal();
    const sec = seedSection(courseId, "Week 1", 0);
    const l1 = seedLesson(sec, courseId, { position: 0 });
    const l2 = seedLesson(sec, courseId, { position: 1 });

    const { enrollment } = ensureEnrollment(TENANT, courseId, "prog@example.com", "free");
    expect(courseLessonCount(courseId)).toBe(2);

    const p1 = markLessonProgress(enrollment as EnrollmentRow, l1, { completed: true });
    expect(p1.courseCompleted).toBe(false);
    expect(enrollmentProgress(enrollment.id, courseId)).toEqual({ completed: 1, total: 2, pct: 50 });

    const p2 = markLessonProgress(enrollment as EnrollmentRow, l2, { completed: true });
    expect(p2.courseCompleted).toBe(true);
    expect(enrollmentProgress(enrollment.id, courseId)).toEqual({ completed: 2, total: 2, pct: 100 });

    const reloaded = row<{ completed_at: string | null }>("SELECT completed_at FROM enrollments WHERE id = ?", enrollment.id);
    expect(reloaded?.completed_at).toBeTruthy();

    // completion is not re-stamped, and further marks stay idempotent
    const again = markLessonProgress(enrollment as EnrollmentRow, l1, { completed: true });
    expect(again.courseCompleted).toBe(false);
  });

  it("unmarking a lesson reduces progress", () => {
    const courseId = seedCourseMinimal();
    const sec = seedSection(courseId, "Week 1", 0);
    const l1 = seedLesson(sec, courseId, { position: 0 });
    const l2 = seedLesson(sec, courseId, { position: 1 });

    const { enrollment } = ensureEnrollment(TENANT, courseId, "unmark@example.com", "free");
    markLessonProgress(enrollment as EnrollmentRow, l1, { completed: true });
    markLessonProgress(enrollment as EnrollmentRow, l2, { completed: true });
    expect(enrollmentProgress(enrollment.id, courseId).completed).toBe(2);

    markLessonProgress(enrollment as EnrollmentRow, l1, { completed: false });
    expect(enrollmentProgress(enrollment.id, courseId)).toEqual({ completed: 1, total: 2, pct: 50 });
  });

  it("courseTree filters unpublished lessons unless requested", () => {
    const courseId = seedCourseMinimal();
    const sec = seedSection(courseId, "Week 1", 0);
    seedLesson(sec, courseId, { position: 0, published: 1 });
    seedLesson(sec, courseId, { position: 1, published: 0 });

    const published = courseTree(courseId, { includeUnpublished: false });
    expect(published[0].lessons).toHaveLength(1);

    const allVersions = courseTree(courseId, { includeUnpublished: true });
    expect(allVersions[0].lessons).toHaveLength(2);
  });

  it("enforces access by matching enrollment email", () => {
    const courseId = seedCourseMinimal();
    const { enrollment } = ensureEnrollment(TENANT, courseId, "owner@example.com", "free");
    expect(canAccessEnrollment(enrollment, "owner@example.com")).toBe(true);
    expect(canAccessEnrollment(enrollment, "other@example.com")).toBe(false);
    expect(canAccessEnrollment(enrollment, undefined)).toBe(false);
    expect(enrollmentFor(TENANT, courseId, "OWNER@example.com")?.id).toBe(enrollment.id);
  });
});