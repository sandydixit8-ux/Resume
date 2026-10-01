import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { audit } from "@/lib/audit";

/** Agency mode: clients group websites for client-facing dashboards. */
export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:read")) return err.auth();
  const items = all(
    `SELECT c.id, c.name, c.contact, c.status, c.created_at,
            (SELECT COUNT(*) FROM websites w WHERE w.client_id = c.id AND w.deleted_at IS NULL) AS websites
     FROM clients c WHERE c.tenant_id = ? ORDER BY c.created_at DESC LIMIT 100`,
    s.org.id
  );
  return ok({ items, mode: s.org.mode });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().max(200).default(""),
  notes: z.string().max(1000).default(""),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const id = newId("cli");
  run(
    "INSERT INTO clients (id, tenant_id, name, contact, notes, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)",
    id,
    s.org.id,
    parsed.data.name,
    parsed.data.contact,
    parsed.data.notes,
    nowIso()
  );
  if (s.org.mode !== "agency") {
    run("UPDATE organizations SET mode = 'agency', updated_at = ? WHERE id = ?", nowIso(), s.org.id);
  }
  audit({ tenantId: s.org.id, userId: s.user.id, action: "agency.client_create", entity: "client", entityId: id });
  return ok({ id, mode: "agency" });
}

const patchSchema = z.object({
  websiteId: z.string().min(1),
  clientId: z.string().nullable(),
});

/** Assign a website to a client (or unassign with null). */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  if (parsed.data.clientId) {
    const client = row<{ id: string }>(
      "SELECT id FROM clients WHERE id = ? AND tenant_id = ?",
      parsed.data.clientId,
      s.org.id
    );
    if (!client) return err.notFound();
  }

  const res = run(
    "UPDATE websites SET client_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    parsed.data.clientId,
    nowIso(),
    parsed.data.websiteId,
    s.org.id
  );
  if (res.changes !== 1) return err.notFound();
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "agency.website_assign",
    entity: "website",
    entityId: parsed.data.websiteId,
    meta: { clientId: parsed.data.clientId },
  });
  return ok({ websiteId: parsed.data.websiteId, clientId: parsed.data.clientId });
}

export function agencySummary(tenantId: string) {
  return tx(() => ({
    clients: row<{ n: number }>("SELECT COUNT(*) AS n FROM clients WHERE tenant_id = ?", tenantId)?.n ?? 0,
  }));
}
