"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, Lightbulb, Loader2, Sparkles, Target, TrendingUp, Wand2 } from "lucide-react";
import { useState } from "react";

interface Insights {
  score: number;
  summary: string;
  wins: string[];
  opportunities: string[];
  quickWins: string[];
  nextTarget: string;
}

export function CoachPanel() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);

  async function run() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/coach/analyze", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setConfigured(j.data.configured);
        if (j.data.insights) {
          setInsights(j.data.insights as Insights);
          setMessage("");
        } else {
          setInsights(null);
          setMessage(j.data.error || j.data.message || "No insights available.");
        }
      } else {
        setMessage(j.error?.message || "Could not run analysis");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {configured === false && (
        <div className="card border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-navy-900">AI Coach not configured</h2>
              <p className="mt-1 text-sm text-amber-800">
                Add <code className="rounded bg-white px-1">AI_API_KEY</code> to your <code className="rounded bg-white px-1">.env</code> to get
                personalized, data-backed insights. Set <code className="rounded bg-white px-1">OPENAI_API_KEY</code> for the default provider.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-navy-950">
              <Wand2 className="h-5 w-5 text-brand-600" /> Your growth analysis
            </h2>
            <p className="mt-1 text-sm text-navy-500">Uses your last 30 days of traffic, leads, bookings and services.</p>
          </div>
          <button type="button" onClick={run} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyzing…" : insights ? "Re-analyze" : "Analyze my business"}
          </button>
        </div>
      </div>

      {message && !insights && <div className="card p-5 text-sm text-navy-500">{message}</div>}

      {insights && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-8 border-brand-100">
                <div className="absolute inset-0 rounded-full border-8 border-transparent" style={{ borderTopColor: scoreColor(insights.score), filter: "blur(0.5px)" }} />
                <span className="text-2xl font-bold text-navy-950">{insights.score}</span>
              </div>
              <div>
                <h2 className="flex items-center gap-2 font-bold text-navy-950">
                  <TrendingUp className="h-4 w-4 text-brand-600" /> Growth score
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-navy-600">{insights.summary}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <InsightCard icon={CheckCircle2} color="text-emerald-600" title="What's working" items={insights.wins} />
            <InsightCard icon={Lightbulb} color="text-amber-600" title="Opportunities" items={insights.opportunities} />
            <InsightCard icon={Target} color="text-brand-600" title="Quick wins" items={insights.quickWins} />
          </div>

          <div className="card p-6">
            <h2 className="flex items-center gap-2 font-semibold text-navy-900">
              <ArrowUpRight className="h-4 w-4 text-brand-600" /> Headline target for the next 30 days
            </h2>
            <p className="mt-2 text-lg font-semibold text-navy-950">{insights.nextTarget}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function scoreColor(n: number): string {
  if (n >= 70) return "#10b981";
  if (n >= 40) return "#f59e0b";
  return "#ef4444";
}

function InsightCard(props: { icon: typeof Lightbulb; color: string; title: string; items: string[] }) {
  return (
    <div className="card p-5">
      <h3 className={`flex items-center gap-2 text-sm font-semibold ${props.color}`}>
        <props.icon className="h-4 w-4" /> {props.title}
      </h3>
      {props.items.length === 0 ? (
        <p className="mt-3 text-sm text-navy-400">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {props.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-navy-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-300" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}