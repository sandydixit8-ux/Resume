import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CheckCircle2, Users, GraduationCap } from "lucide-react";
import { row } from "@/lib/db/db";
import { getCourseBySlug, courseTree, courseLessonCount } from "@/lib/courses/engine";
import { EnrollmentForm } from "@/components/courses/enrollment-form";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { username, slug } = await props.params;
  const profile = row<{ tenant_id: string; display_name: string }>("SELECT tenant_id, display_name FROM profiles WHERE username = ?", username);
  const course = profile ? getCourseBySlug(profile.tenant_id, slug) : undefined;
  if (!profile || !course || course.published !== 1) return { title: "Course not found — CreatorOS" };
  return {
    title: `${course.title} — ${profile.display_name || username}`,
    description: course.description || `${course.title} by ${profile.display_name || username}`,
  };
}

export default async function PublicCoursePage(props: PageProps) {
  const { username, slug } = await props.params;
  const profile = row<{ tenant_id: string; display_name: string; avatar_url: string }>(
    "SELECT tenant_id, display_name, avatar_url FROM profiles WHERE username = ?",
    username
  );
  const course = profile ? getCourseBySlug(profile.tenant_id, slug) : undefined;
  if (!profile || !course || course.published !== 1) return <div className="py-20 text-center text-sm text-navy-400">Course not found or unpublished.</div>;

  const sections = courseTree(course.id, { includeUnpublished: false });
  const lessonCount = courseLessonCount(course.id);
  const students = Number(row<{ c: number }>("SELECT COUNT(*) AS c FROM enrollments WHERE course_id = ?", course.id)?.c ?? 0);

  const isPaid = course.price_cents > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="border-b border-navy-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="flex items-center gap-3">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.display_name || username} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {(profile.display_name || username).slice(0, 1)}
              </span>
            )}
            <span className="text-sm text-navy-500">
              by <span className="font-medium text-navy-800">{profile.display_name || username}</span>
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">{course.title}</h1>
          {course.description && <p className="mt-3 max-w-2xl text-navy-600">{course.description}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-navy-500">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {lessonCount} lessons</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {students} students</span>
            <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> Certificate of completion</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="text-3xl font-bold text-navy-950">{isPaid ? formatPrice(course.price_cents, course.currency) : "Free"}</span>
            <EnrollmentForm courseId={course.id} isPaid={isPaid} />
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="text-xl font-bold text-navy-950">Curriculum</h2>

        {sections.length === 0 ? (
          <p className="mt-4 text-sm text-navy-400">This course is still being written.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {sections.map((sec) => (
              <div key={sec.id} className="overflow-hidden rounded-2xl border border-navy-100">
                <div className="bg-navy-50/70 px-5 py-3 font-semibold text-navy-900">{sec.title}</div>
                <div className="divide-y divide-navy-50">
                  {sec.lessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-5 py-3 text-sm text-navy-600">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-navy-300" />
                      <span className="flex-1 truncate">{lesson.title}</span>
                      {lesson.duration_min > 0 && <span className="shrink-0 text-xs text-navy-400">{lesson.duration_min} min</span>}
                      <span className="shrink-0 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-navy-500">{lesson.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-navy-400">
          Created with CreatorOS · <Link href="/" className="underline">creatoros.dev</Link>
        </p>
      </div>
    </div>
  );
}