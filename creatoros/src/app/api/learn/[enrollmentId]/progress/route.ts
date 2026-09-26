import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row } from "@/lib/db/db";
import { getEnrollment, canAccessEnrollment, markLessonProgress, type EnrollmentRow } from "@/lib/courses/engine";

const schema = z.object({
  lessonId: z.string().min(1).max(60),
  completed: z.boolean(),
  /** Quiz answers are graded server-side against the stored lesson content. */
  answer: z.number().int().min(0).max(20).optional(),
});

interface QuizContent {
  question?: string;
  options?: string[];
  answerIndex?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();

  const { enrollmentId } = await params;
  const enrollment = getEnrollment(enrollmentId);
  if (!enrollment) return err.notFound();
  if (!canAccessEnrollment(enrollment, s.user.email)) return err.forbidden();

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const lesson = row<{ id: string; course_id: string; type: string; content: string }>(
    "SELECT id, course_id, type, content FROM lessons WHERE id = ? AND published = 1",
    parsed.data.lessonId
  );
  if (!lesson || lesson.course_id !== enrollment.course_id) return err.notFound();

  let completed = parsed.data.completed;
  let score = -1;

  if (lesson.type === "quiz") {
    let quiz: QuizContent = {};
    try {
      quiz = JSON.parse(lesson.content) as QuizContent;
    } catch {
      return err.server();
    }
    if (parsed.data.answer === undefined || quiz.answerIndex === undefined) {
      return err.validation({ answer: "An answer is required for quizzes" });
    }
    score = parsed.data.answer === quiz.answerIndex ? 100 : 0;
    completed = score === 100;
  }

  const result = markLessonProgress(enrollment as EnrollmentRow, lesson.id, { completed, score });
  return ok({ ...result, score });
}
