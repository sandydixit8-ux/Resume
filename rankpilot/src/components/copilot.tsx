"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Card } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";

type Answer = {
  observed: string[];
  interpretation: string;
  recommendation: string;
  missingData: string[];
};

type Msg = { id: string; role: string; content: string; epistemic: string };

const SUGGESTIONS = [
  "What should I fix first?",
  "Which issues are costing me the most score?",
  "What content should I write next?",
  "What data am I missing?",
];

export function Copilot({
  websites,
  initialThreadId,
  initialMessages,
}: {
  websites: Array<{ id: string; name: string }>;
  initialThreadId?: string;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(websites[0]?.id ?? "");
  const [, setThreadId] = useState<string | undefined>(initialThreadId);
  const idRef = useRef(0);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    const optimisticId = `tmp_${(idRef.current += 1)}`;
    setMessages((m) => [...m, { id: optimisticId, role: "user", content: q, epistemic: "{}" }]);

    const res = await api<{ threadId: string; answer: Answer; degraded?: string | null }>("/api/copilot", {
      method: "POST",
      json: { websiteId, question: q },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      setMessages((m) => m.filter((x) => x.id !== optimisticId));
      return;
    }
    setDegraded(res.data.degraded ?? null);
    setThreadId(res.data.threadId);
    setMessages((m) => [
      ...m,
      {
        id: `ans_${m.length}`,
        role: "assistant",
        content: JSON.stringify(res.data.answer),
        epistemic: JSON.stringify({ source: "ai" }),
      },
    ]);
    setQuestion("");
    router.replace(`/app/copilot?thread=${res.data.threadId}`);
  }

  return (
    <Card className="flex h-[32rem] flex-col p-0">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <label className="text-xs text-ink-500">
          Website
          <select className="input ml-2 w-auto" value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {degraded ? <span className="ml-auto text-xs text-amber-700">{degraded}</span> : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-500">Ask anything about your growth:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn-ghost" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
            {m.role === "user" ? (
              <span className="inline-block max-w-[80%] rounded-2xl bg-brand-600 px-4 py-2 text-sm text-white">
                {m.content}
              </span>
            ) : (
              <AnswerBlock raw={m.content} />
            )}
          </div>
        ))}

        {busy ? <div className="text-sm text-ink-400">Thinking from your crawl data…</div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="border-t border-ink-100 p-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={question}
            placeholder="e.g. Which page should I optimize first?"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask(question);
            }}
          />
          <button className="btn-primary" onClick={() => void ask(question)} disabled={busy || !question.trim()}>
            Ask
          </button>
        </div>
      </div>
    </Card>
  );
}

function AnswerBlock({ raw }: { raw: string }) {
  let a: Answer | null = null;
  try {
    a = JSON.parse(raw) as Answer;
  } catch {
    a = null;
  }
  if (!a) return <div className="text-sm text-ink-700">{raw}</div>;

  return (
    <div className="max-w-[85%] space-y-3 rounded-xl border border-ink-200 bg-white p-4 text-left">
      <div className="space-y-1.5">
        <EpistemicBadge kind="observed" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
          {a.observed.length ? a.observed.map((o, i) => <li key={i}>{o}</li>) : <li>Data unavailable</li>}
        </ul>
      </div>
      <div className="space-y-1.5">
        <EpistemicBadge kind="interpretation" />
        <p className="text-sm text-ink-700">{a.interpretation}</p>
      </div>
      <div className="space-y-1.5">
        <EpistemicBadge kind="recommendation" />
        <p className="text-sm text-ink-700">{a.recommendation}</p>
      </div>
      {a.missingData.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-2">
          <span className="text-xs text-ink-400">Missing data:</span>
          {a.missingData.map((m, i) => (
            <Badge key={i} tone="low">
              {m}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
