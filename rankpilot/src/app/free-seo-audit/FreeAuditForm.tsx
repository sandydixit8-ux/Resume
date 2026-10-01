/**
 * Free audit form.
 *
 * Split out of page.tsx so the route itself can be a server component and export
 * `metadata`. A "use client" page cannot export metadata at all, so this URL
 * silently inherited the root layout's `alternates.canonical: "/"` and told
 * search engines it was a duplicate of the homepage -- the single page on the
 * site most worth ranking.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge, ProgressBar, ScoreRing } from "@/components/ui";

interface AuditIssue {
  code: string;
  category: string;
  severity: string;
  title: string;
  recommendation: string;
}

interface Audit {
  url: string;
  score: number;
  components: Record<string, { score: number; weight: number }>;
  issues: AuditIssue[];
  issueCount: number;
  page: { title: string | null; wordCount: number; status: number };
  robotsPresent: boolean;
  sitemapPresent: boolean;
}

const COMPONENT_LABELS: Record<string, string> = {
  technical: "Technical SEO",
  onpage: "On-Page SEO",
  content: "Content",
  aeo: "AEO",
  geo: "GEO",
  performance: "Performance",
  authority: "Authority",
};

export default function FreeAuditForm() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAudit(null);
    setLoading(true);
    const res = await api<{ audit: Audit }>("/api/audit/free", { json: { url } });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setAudit(res.data.audit);
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-ink-100">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">R</span>
            RankPilot AI
          </Link>
          <Link href="/register" className="btn-primary">Create free account</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
          Free SEO Audit
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-600">
          Enter your URL for a limited growth audit — score, top issues and quick wins. No
          account needed, no fabricated metrics.
        </p>

        <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="https://yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            aria-label="Website URL"
          />
          <button className="btn-primary px-6" disabled={loading}>
            {loading ? "Auditing…" : "Audit my website"}
          </button>
        </form>
        {error ? (
          <p className="mx-auto mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-ink-400">
          Up to 5 free audits per day. We fetch robots.txt, the sitemap and your homepage only.
        </p>
      </section>

      {audit ? (
        <section className="mx-auto max-w-4xl space-y-6 px-4 pb-16">
          <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row">
            <ScoreRing score={audit.score} size={132} />
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-medium text-ink-900">{audit.url}</div>
              <div className="mt-1 text-xs text-ink-400">
                {audit.page.title ?? "No title tag"} · {audit.page.wordCount} words ·{" "}
                {audit.issueCount} issues found on this page
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
                <Badge tone={audit.robotsPresent ? "resolved" : "low"}>
                  robots.txt {audit.robotsPresent ? "found" : "missing"}
                </Badge>
                <Badge tone={audit.sitemapPresent ? "resolved" : "low"}>
                  sitemap {audit.sitemapPresent ? "found" : "missing"}
                </Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink-400">
                This is a single-page preview. A full audit crawls every page, scores all
                components and builds your prioritized action list.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">Components</div>
              <div className="mt-3 space-y-3">
                {Object.entries(audit.components).map(([key, c]) => (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-ink-700">{COMPONENT_LABELS[key] ?? key}</span>
                      <span className="font-medium text-ink-900">{c.score}</span>
                    </div>
                    <ProgressBar value={c.score} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">Top issues</div>
              {audit.issues.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">No issues detected on this page.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {audit.issues.map((i) => (
                    <li key={i.code}>
                      <div className="flex items-center gap-2">
                        <Badge tone={i.severity}>{i.severity}</Badge>
                        <span className="text-sm font-medium text-ink-900">{i.title}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-ink-500">{i.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <h2 className="text-lg font-semibold text-ink-900">Unlock the full Growth Report</h2>
            <p className="max-w-md text-sm text-ink-600">
              Crawl every page, get component-level scores with methodology, AEO question
              discovery, keywords and a prioritized action list.
            </p>
            <Link href="/register" className="btn-primary">Get my full report</Link>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-ink-100 py-8 text-center text-xs text-ink-400">
        <p>We don&apos;t guarantee rankings, traffic or citations — we optimize what can be measured.</p>
        <p className="mt-2 flex justify-center gap-4">
          <Link href="/pricing" className="hover:text-ink-600">
            Pricing
          </Link>
          <Link href="/legal/terms" className="hover:text-ink-600">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-ink-600">
            Privacy
          </Link>
        </p>
      </footer>
    </main>
  );
}
