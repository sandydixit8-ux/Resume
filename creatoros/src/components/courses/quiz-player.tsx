"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Quiz {
  question?: string;
  options?: string[];
  answerIndex?: number;
}

export function QuizPlayer(props: { lessonId: string; enrollmentId: string; content: string }) {
  const router = useRouter();
  const quiz = useMemo<Quiz>(() => {
    try {
      return JSON.parse(props.content) as Quiz;
    } catch {
      return {};
    }
  }, [props.content]);

  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const options = quiz.options ?? [];

  async function submit() {
    if (selected === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/learn/${props.enrollmentId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: props.lessonId, completed: false, answer: selected }),
      });
      const j = await res.json();
      setResult({ correct: j.ok && j.data?.score === 100, score: j.data?.score ?? 0 });
      if (j.ok && j.data?.score === 100) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-navy-400">This quiz isn&apos;t configured yet (needs question + options).</p>;
  }

  return (
    <div className="rounded-xl border border-navy-100 p-6">
      <h2 className="font-semibold text-navy-900">{quiz.question || "Untitled question"}</h2>
      <div className="mt-4 space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={result !== null}
            onClick={() => setSelected(i)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              selected === i ? "border-brand-500 bg-brand-50 text-brand-700" : result === null ? "border-navy-100 text-navy-700 hover:border-brand-300 hover:bg-navy-50/50" : "border-navy-100 text-navy-400"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${selected === i ? "border-brand-500 bg-brand-500 text-white" : "border-navy-200"}`}>{i + 1}</span>
            {opt}
          </button>
        ))}
      </div>

      {result === null ? (
        <button type="button" onClick={submit} disabled={busy || selected === null} className="btn-primary mt-5 !py-2 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit answer"}
        </button>
      ) : (
        <div className={`mt-5 rounded-xl p-4 text-sm font-medium ${result.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {result.correct ? "Correct! Lesson completed." : "Not quite — try again. Keep studying and retry."}
        </div>
      )}
    </div>
  );
}