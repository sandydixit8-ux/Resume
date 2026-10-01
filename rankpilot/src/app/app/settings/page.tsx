import { getSession } from "@/lib/auth/get-session";
import { all, row } from "@/lib/db/db";
import { Card, Badge } from "@/components/ui";
import { usageReport } from "@/lib/usage";
import { monthlySpend } from "@/lib/ai/meter";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = (await getSession())!;
  const usage = usageReport(s.org.id, s.org.plan);
  const spend = monthlySpend(s.org.id);
  const memberCount =
    row<{ n: number }>("SELECT COUNT(*) AS n FROM memberships WHERE tenant_id = ?", s.org.id)?.n ?? 0;
  const org = row<{ name: string; slug: string; mode: string }>(
    "SELECT name, slug, mode FROM organizations WHERE id = ?",
    s.org.id
  );
  const websites =
    row<{ n: number }>("SELECT COUNT(*) AS n FROM websites WHERE tenant_id = ? AND deleted_at IS NULL", s.org.id)?.n ?? 0;
  const integrations = all<{ provider: string; status: string }>(
    "SELECT provider, status FROM integrations WHERE tenant_id = ?",
    s.org.id
  );

  const ai = usage.metrics.find((m) => m.metric === "aiGenerations");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-ink-400">Workspace</div>
          <div className="text-sm font-medium text-ink-900">{org?.name}</div>
          <div className="text-xs text-ink-400">
            /{org?.slug} · {org?.mode} · {websites} websites
          </div>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-ink-400">Plan</div>
          <div className="pt-1">
            <Badge tone="new">{s.org.plan}</Badge>
          </div>
          <a href="/app/settings/billing" className="text-xs text-brand-700 hover:underline">
            Manage billing →
          </a>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-ink-400">Members</div>
          <div className="text-lg font-semibold text-ink-900">{memberCount}</div>
          <a href="/app/settings/members" className="text-xs text-brand-700 hover:underline">
            Manage access →
          </a>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-ink-400">AI generations this period</div>
          <div className="text-lg font-semibold text-ink-900">
            {ai?.used ?? 0} / {ai?.limit ?? 0}
          </div>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-ink-400">AI spend this month</div>
          <div className="text-lg font-semibold text-ink-900">${spend.costUsd.toFixed(4)}</div>
          <div className="text-xs text-ink-400">{spend.calls} metered calls</div>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-ink-400">Connected integrations</div>
          <div className="text-lg font-semibold text-ink-900">{integrations.length}</div>
          <a href="/app/settings/integrations" className="text-xs text-brand-700 hover:underline">
            Configure →
          </a>
        </Card>
      </div>

      <ProfileForm name={s.user.name} email={s.user.email} role={s.role} />
    </div>
  );
}
