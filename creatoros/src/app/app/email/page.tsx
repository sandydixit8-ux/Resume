import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";
import { EmailCenter } from "@/components/email/email-center";
import { campaignStats, campaignEngagement } from "@/lib/email/engine";
import { getLimits } from "@/lib/plans";
import { getUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const limits = getLimits(s.org.plan);
  const emailAutomation = limits.emailAutomation;
  const emailsUsed = getUsage(s.org.id, "emails");

  const campaigns = all<{
    id: string;
    list_id: string | null;
    template_id: string | null;
    subject: string;
    from_name: string;
    status: string;
    scheduled_at: string | null;
    sent_at: string | null;
    stats: string;
    created_at: string;
  }>(
    "SELECT id, list_id, template_id, subject, from_name, status, scheduled_at, sent_at, stats, created_at FROM email_campaigns WHERE tenant_id = ? ORDER BY created_at DESC",
    s.org.id
  ).map((c) => ({
    ...c,
    stats: { ...campaignStats(c), ...campaignEngagement(c.id) },
  }));

  const lists = all<{ id: string; name: string; created_at: string; memberCount: number }>(
    `SELECT l.id, l.name, l.created_at, COUNT(m.id) AS memberCount
     FROM email_lists l LEFT JOIN email_list_members m ON m.list_id = l.id
     WHERE l.tenant_id = ? GROUP BY l.id ORDER BY l.created_at ASC`,
    s.org.id
  );

  const contacts = all<{ id: string; email: string; name: string }>(
    "SELECT id, email, name FROM contacts WHERE tenant_id = ? AND consent = 1 ORDER BY created_at DESC",
    s.org.id
  );

  const memberships = all<{ list_id: string; contact_id: string }>(
    `SELECT m.list_id, m.contact_id FROM email_list_members m JOIN email_lists l ON l.id = m.list_id WHERE l.tenant_id = ?`,
    s.org.id
  );

  const templates = all<{ id: string; name: string; subject: string; body: string; updated_at: string }>(
    "SELECT id, name, subject, body, updated_at FROM email_templates WHERE tenant_id = ? ORDER BY updated_at DESC",
    s.org.id
  );

  const role = s.role as never;
  const canWrite = can(role, "email:write");
  const canRead = can(role, "email:read");

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Email</h1>
          <p className="mt-1 text-sm text-navy-500">Newsletters &amp; broadcasts from your list.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="btn-secondary">
            <Mail className="h-4 w-4" /> {emailsUsed}{limits.emailsPerMonth !== -1 ? ` / ${limits.emailsPerMonth}` : ""} emails/mo
          </span>
        </div>
      </div>

      {!emailAutomation && (
        <div className="card border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-navy-900">Email automation needs a paid plan</h2>
          <p className="mt-1 text-sm text-navy-600">Upgrade to Creator or higher to send broadcasts to your list.</p>
        </div>
      )}

      {canRead && (
        <EmailCenter
          initialCampaigns={campaigns}
          initialLists={lists}
          initialContacts={contacts}
          initialMemberships={memberships}
          initialTemplates={templates}
          canWrite={canWrite}
          emailAutomation={emailAutomation}
        />
      )}
    </div>
  );
}