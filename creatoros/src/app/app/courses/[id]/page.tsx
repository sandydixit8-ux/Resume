import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { getCourse, courseTree } from "@/lib/courses/engine";
import { row } from "@/lib/db/db";
import { CourseBuilder } from "@/components/courses/course-builder";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CourseBuilderPage({ params }: Props) {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  if (!can(s.role as never, "courses:read")) redirect("/app");

  const { id } = await params;
  const course = getCourse(id);
  if (!course || course.tenant_id !== s.org.id) notFound();

  const sections = courseTree(id, { includeUnpublished: true });
  const profile = row<{ username: string }>("SELECT username FROM profiles WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1", s.org.id);
  const students = Number(row<{ c: number }>("SELECT COUNT(*) AS c FROM enrollments WHERE course_id = ?", id)?.c ?? 0);

  return (
    <CourseBuilder
      initialCourse={course}
      initialSections={sections}
      students={students}
      username={profile?.username ?? ""}
      canWrite={can(s.role as never, "courses:write")}
    />
  );
}
