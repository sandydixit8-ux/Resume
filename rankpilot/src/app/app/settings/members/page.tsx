import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Card, Badge } from "@/components/ui";
import { can } from "@/lib/auth/rbac";
import { MemberControls } from "./member-controls";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const s = (await getSession())!;
  const members = all<{ id: string; user_id: string; role: string; name: string; email: string; created_at: string }>(
    `SELECT m.id, m.user_id, m.role, m.created_at, u.name, u.email
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = ? ORDER BY m.created_at ASC`,
    s.org.id
  );

  const editable = can(s.role, "members:write");

  return (
    <div className="space-y-4">
      <Card className="divide-y divide-ink-100 p-0">
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink-900">{m.name}</div>
              <div className="truncate text-xs text-ink-400">{m.email}</div>
            </div>
            <Badge tone={m.role === "owner" ? "new" : "low"}>{m.role}</Badge>
            <MemberControls
              self={m.user_id === s.user.id}
              currentRole={m.role}
              editable={editable}
              membershipId={m.id}
              isOwnerMember={members.some((x) => x.role === "owner")}
            />
          </div>
        ))}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Roles</h2>
        <ul className="grid gap-1.5 text-sm text-ink-600 sm:grid-cols-2">
          <li><b>owner</b> — everything, including billing</li>
          <li><b>admin</b> — everything except billing</li>
          <li><b>editor</b> — issues, actions, content, social</li>
          <li><b>analyst</b> — read-only dashboards and reports</li>
          <li><b>client</b> — read-only, for agency client portals</li>
        </ul>
      </Card>

      <p className="text-xs text-ink-400">
        Invites need an email provider, which is not configured in this build — members appear here when they
        register with an invite link.
      </p>
    </div>
  );
}
