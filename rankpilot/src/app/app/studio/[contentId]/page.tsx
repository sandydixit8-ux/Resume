import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { all, row } from "@/lib/db/db";
import { Badge, Card } from "@/components/ui";
import { DiffView, EpistemicBadge, type DiffRow } from "@/components/growth";
import { Editor } from "@/components/studio-editor";
import { RepurposePanel } from "@/components/repurpose";

export const dynamic = "force-dynamic";

export default async function ContentDetail({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const session = (await getSession())!;
  const { contentId } = await params;

  const content = row<{
    id: string;
    website_id: string | null;
    title: string;
    body: string;
    meta: string;
    status: string;
    type: string;
    updated_at: string;
  }>(
    "SELECT id, website_id, title, body, meta, status, type, updated_at FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    contentId,
    session.org.id
  );
  if (!content) notFound();

  const versions = all<{
    id: string;
    version: number;
    title: string;
    changes: string;
    source: string;
    status: string;
    created_at: string;
    approved_at: string | null;
  }>(
    `SELECT id, version, title, changes, source, status, created_at, approved_at
     FROM content_versions WHERE content_id = ? AND tenant_id = ? ORDER BY version DESC`,
    contentId,
    session.org.id
  );

  const meta = JSON.parse(content.meta || "{}") as Record<string, unknown>;
  const latestChanges: DiffRow[] = versions[0]
    ? (JSON.parse(versions[0].changes || "[]") as DiffRow[])
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href="/app/studio" className="text-sm text-ink-400 hover:text-brand-700">
              ← Studio
            </Link>
            <Badge tone={content.status === "approved" ? "approved" : content.status === "published" ? "completed" : "new"}>
              {content.status}
            </Badge>
            <Badge tone="low">{content.type}</Badge>
            {content.website_id ? (
              <Link href={`/app/websites/${content.website_id}`} className="text-sm text-brand-700 hover:underline">
                View website
              </Link>
            ) : null}
          </div>
          <h1 className="mt-1 truncate text-xl font-semibold text-ink-900">{content.title}</h1>
        </div>
      </div>

      {typeof meta.source === "string" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <EpistemicBadge kind="interpretation" />
          <span>
            source: {meta.source} · prompt {String(meta.promptVersion ?? "n/a")}
            {meta.degraded ? ` · ${String(meta.degraded)}` : ""}
          </span>
        </div>
      ) : null}

      <Editor
        contentId={content.id}
        websiteId={content.website_id ?? ""}
        initialTitle={content.title}
        initialBody={content.body}
        status={content.status as "draft" | "review" | "approved" | "published" | "rejected"}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-900">Latest changes (BEFORE / AFTER)</h2>
          <DiffView changes={latestChanges} />
          <p className="text-xs text-ink-400">
            Each save creates a version. Nothing leaves draft state until you approve it.
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-900">Versions</h2>
          {versions.length === 0 ? (
            <p className="text-sm text-ink-500">No versions recorded.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink-700">
                    v{v.version} · {v.source}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={v.status === "approved" ? "approved" : "new"}>{v.status}</Badge>
                    <span className="text-xs text-ink-400">{v.created_at.slice(0, 16).replace("T", " ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {Array.isArray(meta.faqs) && (meta.faqs as unknown[]).length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-900">FAQ block (approval-gated)</h2>
          <ul className="space-y-3">
            {(meta.faqs as Array<{ question: string; answer: string }>).map((f, i) => (
              <li key={i}>
                <div className="text-sm font-medium text-ink-800">{f.question}</div>
                <div className="text-sm text-ink-600">{f.answer}</div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Repurpose into channels</h2>
          <EpistemicBadge kind="interpretation" />
        </div>
        <RepurposePanel
          contentId={content.id}
          status={content.status as "draft" | "review" | "approved" | "published" | "rejected"}
        />
      </Card>
    </div>
  );
}
