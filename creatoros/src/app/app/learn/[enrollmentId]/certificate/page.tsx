import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Award } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { getEnrollment, canAccessEnrollment, getCourse } from "@/lib/courses/engine";
import { row } from "@/lib/db/db";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ enrollmentId: string }> };

export default async function CertificatePage(props: PageProps) {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const { enrollmentId } = await props.params;
  const enrollment = getEnrollment(enrollmentId);
  if (!enrollment) notFound();
  if (!canAccessEnrollment(enrollment, s.user.email)) notFound();
  if (!enrollment.completed_at) redirect(`/app/learn/${enrollmentId}`);

  const course = getCourse(enrollment.course_id);
  if (!course) notFound();

  const org = row<{ name: string }>("SELECT name FROM organizations WHERE id = ?", enrollment.tenant_id);
  const issued = enrollment.completed_at.slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/app/learn/${enrollmentId}`} className="inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-900">
        ← Back to course
      </Link>

      <div className="rounded-2xl border-2 border-brand-100 bg-gradient-to-br from-white to-brand-50/50 p-10 text-center shadow-sm">
        <Award className="mx-auto h-12 w-12 text-amber-500" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-navy-400">Certificate of Completion</p>
        <h1 className="mt-2 text-3xl font-bold text-navy-950">{course.title}</h1>
        <p className="mt-1 text-sm text-navy-500">Awarded by {org?.name ?? "CreatorOS"}</p>

        <p className="mt-8 text-sm text-navy-400">This certifies that</p>
        <div className="mt-2 font-serif text-2xl text-navy-900">{s.user.name || s.user.email}</div>

        <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-navy-500">
          has successfully completed the full course curriculum, demonstrating mastery of the material.
        </p>

        <div className="mt-8 flex items-center justify-center gap-8 border-t border-navy-100 pt-6 text-xs text-navy-400">
          <div>
            <div className="font-semibold uppercase">Date issued</div>
            <div className="mt-1 text-navy-600">{issued}</div>
          </div>
          <div>
            <div className="font-semibold uppercase">Credential ID</div>
            <div className="mt-1 font-mono text-navy-600">{enrollmentId}</div>
          </div>
          <div>
            <div className="font-semibold uppercase">Recipient</div>
            <div className="mt-1 text-navy-600">{s.user.email}</div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-navy-400">
        Verify this credential with the creator or on their course landing page.
      </p>
    </div>
  );
}