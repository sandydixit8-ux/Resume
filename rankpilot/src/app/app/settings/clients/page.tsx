import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { ClientsPanel } from "@/components/clients";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = (await getSession())!;

  const clients = all<{ id: string; name: string; contact: string; status: string; created_at: string; websites: number }>(
    `SELECT c.id, c.name, c.contact, c.status, c.created_at,
            (SELECT COUNT(*) FROM websites w WHERE w.client_id = c.id AND w.deleted_at IS NULL) AS websites
     FROM clients c WHERE c.tenant_id = ? ORDER BY c.created_at DESC LIMIT 100`,
    session.org.id
  );
  const websites = all<{ id: string; name: string; client_id: string | null }>(
    "SELECT id, name, client_id FROM websites WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name",
    session.org.id
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">Clients (agency)</h2>
        <p className="text-sm text-ink-500">
          Group websites by client. Client-facing dashboards and white-label reports use these groups.
        </p>
      </div>
      <ClientsPanel clients={clients} websites={websites} mode={session.org.mode} />
    </div>
  );
}
