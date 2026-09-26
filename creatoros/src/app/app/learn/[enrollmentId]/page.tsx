import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Award, ArrowRight, ArrowLeft, Play, FileText, Music, File as FileIcon, HelpCircle, ExternalLink } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { getEnrollment, canAccessEnrollment, courseTree, progressFor, enrollmentProgress } from "@/lib/courses/engine";
import { CompleteButton } from "@/components/courses/complete-button";
import { QuizPlayer } from "@/components/courses/quiz-player";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ lesson?: string }>;
};

type PageProps = Props;

function embedVideoUrl(url: string): string {
  const clean = url.trim();
  const yt = clean.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = clean.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return clean;
}

function LessonContent({ lesson }: { lesson: { type: string; content: string } }) {
  switch (lesson.type) {
    case "video": {
      const url = lesson.content.trim();
      if (!url) return <p className="text-sm text-navy-400">No video URL set.</p>;
      if (/(youtube\.com|youtu\.be|vimeo\.com)/.test(url)) {
        return (
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe src={embedVideoUrl(url)} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Lesson video" />
          </div>
        );
      }
      return <video src={url} controls className="aspect-video w-full rounded-xl bg-black" />;
    }
    case "audio":
      return lesson.content.trim() ? (
        <audio src={lesson.content.trim()} controls className="w-full" />
      ) : (
        <p className="text-sm text-navy-400">No audio URL set.</p>
      );
    case "pdf":
      return lesson.content.trim() ? (
        <div>
          <iframe src={lesson.content.trim()} className="h-[480px] w-full rounded-xl border border-navy-100" title="PDF" />
          <a href={lesson.content.trim()} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
            <ExternalLink className="h-4 w-4" /> Open PDF in new tab
          </a>
        </div>
      ) : (
        <p className="text-sm text-navy-400">No PDF URL set.</p>
      );
    case "external":
      return lesson.content.trim() ? (
        <div className="rounded-xl border border-navy-100 p-6 text-center">
          <p className="text-sm text-navy-500">This lesson takes place on an external site.</p>
          <a href={lesson.content.trim()} target="_blank" rel="noreferrer" className="btn-primary mt-4">
            <ExternalLink className="h-4 w-4" /> Open external link
          </a>
        </div>
      ) : (
        <p className="text-sm text-navy-400">No external URL set.</p>
      );
    default:
      return <div className="whitespace-pre-wrap rounded-xl bg-white/70 p-6 text-sm leading-relaxed text-navy-700">{lesson.content || "No content for this lesson yet."}</div>;
  }
}

export default async function CoursePlayerPage(props: PageProps) {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const { enrollmentId } = await props.params;
  const enrollment = getEnrollment(enrollmentId);
  if (!enrollment) notFound();
  if (!canAccessEnrollment(enrollment, s.user.email)) notFound();

  const sections = courseTree(enrollment.course_id, { includeUnpublished: false });
  const lessons = sections.flatMap((sec) => sec.lessons);
  if (lessons.length === 0) notFound();

  const { lesson: requested } = await props.searchParams;
  const current = lessons.find((l) => l.id === requested) ?? lessons[0];
  const index = lessons.findIndex((l) => l.id === current.id);
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;

  const progressMap = new Map(progressFor(enrollmentId).map((p) => [p.lesson_id, p]));
  const total = enrollmentProgress(enrollmentId, enrollment.course_id);

  // find current section title
  const currentSection = sections.find((sec) => sec.lessons.some((l) => l.id === current.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/learn" className="inline-flex items-center gap-1 text-sm text-navy-500 hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" /> My learning
          </Link>
          <div className="mt-1 text-sm text-navy-500">Enrolled · {total.pct}% complete</div>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-navy-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${total.pct}%` }} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-navy-100 bg-white p-3 lg:h-fit">
          <nav className="space-y-4">
            {sections.map((sec) => (
              <div key={sec.id}>
                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-navy-400">{sec.title}</div>
                <div className="mt-1.5 space-y-0.5">
                  {sec.lessons.map((lesson) => {
                    const done = progressMap.get(lesson.id)?.completed;
                    const isCurrent = lesson.id === current.id;
                    return (
                      <Link
                        key={lesson.id}
                        href={`/app/learn/${enrollmentId}?lesson=${lesson.id}`}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                          isCurrent ? "bg-brand-50 font-medium text-brand-700" : done ? "text-navy-400" : "text-navy-600 hover:bg-navy-50"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-navy-200" />}
                        <span className="truncate">{lesson.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-navy-400">{currentSection?.title}</div>
                <h1 className="mt-1 text-lg font-semibold text-navy-900">{current.title}</h1>
              </div>
              <span className="inline-flex items-center gap-1 rounded bg-navy-100 px-2 py-1 text-[11px] font-medium uppercase text-navy-500">
                {current.type === "video" && <Play className="h-3 w-3" />}
                {current.type === "audio" && <Music className="h-3 w-3" />}
                {current.type === "pdf" && <FileIcon className="h-3 w-3" />}
                {current.type === "text" && <FileText className="h-3 w-3" />}
                {current.type === "quiz" && <HelpCircle className="h-3 w-3" />}
                {current.type === "external" && <ExternalLink className="h-3 w-3" />}
                {current.type}
              </span>
            </div>

            <div className="mt-5">
              {current.type === "quiz" ? (
                <QuizPlayer lessonId={current.id} enrollmentId={enrollmentId} content={current.content} />
              ) : (
                <LessonContent lesson={{ type: current.type, content: current.content }} />
              )}
            </div>

            {current.type !== "quiz" && (
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-navy-100 pt-4">
                <CompleteButton
                  lessonId={current.id}
                  enrollmentId={enrollmentId}
                  done={Boolean(progressMap.get(current.id)?.completed)}
                />
                <div className="flex gap-2">
                  {prev && (
                    <Link href={`/app/learn/${enrollmentId}?lesson=${prev.id}`} className="btn-secondary !py-2 text-sm">
                      <ArrowLeft className="h-4 w-4" /> Prev
                    </Link>
                  )}
                  {next && (
                    <Link href={`/app/learn/${enrollmentId}?lesson=${next.id}`} className="btn-primary !py-2 text-sm">
                      Next <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {enrollment.completed_at && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 text-amber-500" />
                <div>
                  <div className="font-semibold text-navy-900">Course completed!</div>
                  <div className="text-sm text-navy-500">Congratulations — you earned your certificate on {enrollment.completed_at.slice(0, 10)}.</div>
                </div>
              </div>
              <Link href={`/app/learn/${enrollmentId}/certificate`} className="btn-primary shrink-0 !py-2 text-sm">
                View certificate
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}