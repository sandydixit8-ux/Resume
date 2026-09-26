import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Award } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { enrollmentProgress } from "@/lib/courses/engine";

export const dynamic = "force-dynamic";

export default async function LearnDashboard() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const enrollments = all<{
    id: string;
    course_id: string;
    title: string;
    slug: string;
    description: string;
    completed_at: string | null;
    created_at: string;
  }>(
    `SELECT e.id, e.course_id, e.completed_at, e.created_at, c.title, c.slug, c.description
     FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.email = ? ORDER BY e.created_at DESC`,
    s.user.email
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">My learning</h1>
        <p className="mt-1 text-sm text-navy-500">Courses you&apos;re enrolled in as {s.user.email}.</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="card p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm text-navy-500">You&apos;re not enrolled in any course yet.</p>
          <p className="mt-1 text-xs text-navy-400">Enroll from a creator&apos;s course page — purchases unlock automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enrollments.map((en) => {
            const progress = enrollmentProgress(en.id, en.course_id);
            return (
              <Link key={en.id} href={`/app/learn/${en.id}`} className="card p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-navy-900">{en.title}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-navy-500">{en.description || "No description"}</p>
                  </div>
                  {en.completed_at && <Award className="h-5 w-5 shrink-0 text-amber-500" />}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-navy-500">
                    <span>{progress.completed}/{progress.total} lessons</span>
                    <span className="font-medium text-navy-700">{progress.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress.pct}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
