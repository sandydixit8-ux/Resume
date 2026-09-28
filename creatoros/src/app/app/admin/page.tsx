import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { isPlatformAdmin } from "@/lib/admin/access";
import { listOrgs, planCursor, listFlags, listOpenTickets, VALID_TICKET_STATUSES } from "@/lib/admin/engine";
import { OrgsTable } from "@/components/admin/orgs-table";
import { FlagsPanel } from "@/components/admin/flags-panel";
import { TicketsPanel } from "@/components/admin/tickets-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  if (!isPlatformAdmin(s.user.email)) {
    return (
      <div className="card p-10 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-navy-300" />
        <h1 className="mt-4 text-xl font-bold text-navy-950">Platform admin only</h1>
        <p className="mt-1 text-sm text-navy-500">You are not authorized to view this page.</p>
      </div>
    );
  }

  const orgs = listOrgs().map((o) => ({ ...o, plan: o.plan }));
  const plans = planCursor();
  const flags = listFlags();
  const tickets = listOpenTickets().map((t) => ({ id: t.id, subject: t.subject, body: t.body, status: t.status, created_at: t.created_at, email: t.email }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Platform admin</h1>
        <p className="mt-1 text-sm text-navy-500">Workspaces, feature flags and support tickets.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Organizations</h2>
        <OrgsTable initial={orgs} plans={plans} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Feature flags</h2>
        <FlagsPanel initial={flags} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Support tickets</h2>
        <TicketsPanel initial={tickets} statuses={VALID_TICKET_STATUSES} />
      </section>
    </div>
  );
}