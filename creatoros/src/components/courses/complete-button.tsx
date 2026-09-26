"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Circle } from "lucide-react";

export function CompleteButton(props: { lessonId: string; enrollmentId: string; done: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/learn/${props.enrollmentId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: props.lessonId, completed: !props.done }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`btn !py-2 text-sm ${props.done ? "btn-secondary" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : props.done ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Circle className="h-4 w-4" />
      )}
      {props.done ? "Completed" : "Mark as complete"}
    </button>
  );
}