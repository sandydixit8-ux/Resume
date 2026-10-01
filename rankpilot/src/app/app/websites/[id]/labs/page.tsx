import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Card } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";
import {
  CmsFixPanel,
  DnaCard,
  ExperimentLab,
  KeywordEnrich,
  ScheduleControl,
  VisibilityPanel,
} from "@/components/labs";

export const dynamic = "force-dynamic";

type VRow = { id: string; experiment_id: string; label: string; traffic_pct: number; result_value: number | null };

export default async function LabsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) notFound();

  const schedule = row<{ id: string; frequency: string; enabled: number; next_run_at: string | null; last_run_at: string | null }>(
    "SELECT id, frequency, enabled, next_run_at, last_run_at FROM crawl_schedules WHERE website_id = ? AND tenant_id = ?",
    id,
    session.org.id
  );

  const dna = row<{
    pages: number;
    avgWords: number | null;
    avgTitleLen: number | null;
    avgMetaLen: number | null;
    pagesWithFaq: number;
    pagesWithSchema: number;
    missingAlt: number;
    images: number;
  }>(
    `SELECT COUNT(*) AS pages,
            AVG(word_count) AS avgWords,
            AVG(title_len) AS avgTitleLen,
            AVG(meta_desc_len) AS avgMetaLen,
            SUM(CASE WHEN structured_types LIKE '%FAQ%' THEN 1 ELSE 0 END) AS pagesWithFaq,
            SUM(CASE WHEN has_structured_data = 1 THEN 1 ELSE 0 END) AS pagesWithSchema,
            SUM(images_missing_alt) AS missingAlt,
            SUM(image_count) AS images
     FROM pages WHERE website_id = ? AND tenant_id = ?`,
    id,
    session.org.id
  );

  const experiments = all<{ id: string; name: string; hypothesis: string; metric: string; status: string; created_at: string }>(
    "SELECT id, name, hypothesis, metric, status, created_at FROM experiments WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    id,
    session.org.id
  );
  const variants = all<VRow>(
    `SELECT v.id, v.experiment_id, v.label, v.traffic_pct, v.result_value
     FROM experiment_variants v JOIN experiments e ON e.id = v.experiment_id
     WHERE e.website_id = ? AND e.tenant_id = ?`,
    id,
    session.org.id
  );
  const visibility = all<{ id: string; engine: string; query: string; brand_mentioned: number | null; checked_at: string }>(
    "SELECT id, engine, query, brand_mentioned, checked_at FROM ai_visibility WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    id,
    session.org.id
  );
  const fixes = all<{ id: string; issue_id: string | null; provider: string; status: string; error: string | null; backup_ref: string | null; created_at: string }>(
    "SELECT id, issue_id, provider, status, error, backup_ref, created_at FROM cms_fixes WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    id,
    session.org.id
  );

  const round = (v: number | null, digits = 0) =>
    v === null || v === undefined ? null : Number(v.toFixed(digits));
  const images = dna?.images ?? 0;
  const missingAlt = dna?.missingAlt ?? 0;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Scheduled crawls</h2>
          <EpistemicBadge kind="observed" />
        </div>
        <ScheduleControl websiteId={id} initial={schedule ?? null} />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Content DNA</h2>
          <EpistemicBadge kind="observed" />
        </div>
        <p className="text-xs text-ink-500">
          Structural fingerprint computed from crawled pages only. Null means not observed.
        </p>
        <DnaCard
          stats={{
            pages: dna?.pages ?? 0,
            averageWordCount: round(dna?.avgWords ?? null, 1),
            averageTitleLength: round(dna?.avgTitleLen ?? null, 1),
            averageMetaDescriptionLength: round(dna?.avgMetaLen ?? null, 1),
            pagesWithFaqSchema: dna?.pagesWithFaq ?? 0,
            pagesWithStructuredData: dna?.pagesWithSchema ?? 0,
            imageAltCoveragePercent: images > 0 ? Number((((images - missingAlt) / images) * 100).toFixed(1)) : null,
          }}
        />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Keyword data</h2>
          <EpistemicBadge kind="observed" />
        </div>
        <KeywordEnrich websiteId={id} />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">AI search visibility</h2>
          <EpistemicBadge kind="observed" />
        </div>
        <VisibilityPanel websiteId={id} initial={visibility} />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Experiments (A/B lab)</h2>
          <EpistemicBadge kind="interpretation" />
        </div>
        <ExperimentLab websiteId={id} initial={experiments} initialVariants={variants} />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">CMS auto-fix</h2>
          <EpistemicBadge kind="observed" />
        </div>
        <CmsFixPanel websiteId={id} initial={fixes} />
      </Card>
    </div>
  );
}
