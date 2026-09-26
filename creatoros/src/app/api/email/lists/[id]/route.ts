import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, run, row, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const listSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:read")) return err.forbidden();

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
  return ok({ lists, contacts, memberships });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = listSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const id = newId("eml");
  run("INSERT INTO email_lists (id, tenant_id, name, created_at) VALUES (?, ?, ?, ?)", id, s.org.id, parsed.data.name, nowIso());
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.list_create", resource: id });
  return ok({ listId: id });
}

const membersSchema = z.object({
  contactIds: z.array(z.string().min(1)).max(200),
  replace: z.boolean().default(false),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM email_lists WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  const body = await readJson(req);
  const parsed = membersSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  if (parsed.data.replace) {
    run("DELETE FROM email_list_members WHERE list_id = ?", id);
  }
  for (const contactId of parsed.data.contactIds) {
    const dup = row("SELECT id FROM email_list_members WHERE list_id = ? AND contact_id = ?", id, contactId);
    if (dup) continue;
    run(
      "INSERT INTO email_list_members (id, tenant_id, list_id, contact_id, created_at) VALUES (?, ?, ?, ?, ?)",
      newId("emmb"),
      s.org.id,
      id,
      contactId,
      nowIso()
    );
  }
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.list_members_update", resource: id });
  return ok({ listId: id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM email_lists WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  run("DELETE FROM email_lists WHERE id = ?", id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.list_delete", resource: id });
  return ok({ listId: id });
}