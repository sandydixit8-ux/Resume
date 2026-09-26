import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { CourseList } from "@/components/courses/course-list";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  if (!can(s.role as never, "courses:read")) redirect("/app");

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Courses</h1>
          <p className="mt-1 text-sm text-navy-500">Sell structured courses with lessons, quizzes and progress tracking.</p>
        </div>
        <span className="btn-secondary">
          <GraduationCap className="h-4 w-4" /> {s.org.plan} plan
        </span>
      </div>

      <CourseList canWrite={can(s.role as never, "courses:write")} />
    </div>
  );
}
