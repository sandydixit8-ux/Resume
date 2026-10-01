import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Card, Badge, EmptyState } from "@/components/ui";
import { IntegrationManager } from "./integration-manager";

export const dynamic = "force-dynamic";

const CATALOG = [
  { provider: "search_console", label: "Google Search Console", benefit: "Keyword impressions & CTR (never guessed when disconnected)", env: "GOOGLE_CLIENT_ID" },
  { provider: "analytics", label: "Google Analytics 4", benefit: "Traffic & conversions for attribution", env: "GA4_API_SECRET" },
  { provider: "wp", label: "WordPress", benefit: "Push approved fixes directly to your CMS", env: "WP_SITE_URL" },
  { provider: "webflow", label: "Webflow", benefit: "Push approved meta/schema fixes", env: "" },
  { provider: "slack", label: "Slack", benefit: "Weekly digest and crawl alerts", env: "SLACK_WEBHOOK_URL" },
  { provider: "serp", label: "SERP / rank tracker", benefit: "Track rankings & AI-search visibility", env: "SERP_API_KEY" },
  { provider: "social_publish", label: "Social publishing", benefit: "Publish approved calendar items", env: "" },
  { provider: "stripe", label: "Stripe billing", benefit: "Real payments and invoices", env: "STRIPE_SECRET_KEY" },
] as const;

export default async function IntegrationsPage() {
  const s = (await getSession())!;
  const rows = all<{ provider: string; status: string; meta: string }>(
    "SELECT provider, status, meta FROM integrations WHERE tenant_id = ?",
    s.org.id
  );
  const map = new Map(rows.map((r) => [r.provider, r.status]));

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3 text-sm text-ink-600">
        Connections are optional. Every feature degrades gracefully when an integration is missing — metrics show
        &quot;Data unavailable&quot; rather than invented values.
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {CATALOG.map((c) => (
          <Card key={c.provider} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-900">{c.label}</span>
              <Badge tone={map.get(c.provider) === "connected" ? "completed" : "low"}>
                {map.get(c.provider) ?? "not connected"}
              </Badge>
            </div>
            <p className="text-xs text-ink-500">{c.benefit}</p>
            {c.env ? (
              <p className="text-[11px] text-ink-400">
                requires <code>{c.env}</code>
                {process.env[c.env] ? " ✓ set" : " — not set"}
              </p>
            ) : null}
            <IntegrationManager provider={c.provider} label={c.label} status={map.get(c.provider) ?? "not connected"} />
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No connections yet" description="Connect a tool when you are ready — nothing here is required to use RankPilot." />
      ) : null}
    </div>
  );
}
