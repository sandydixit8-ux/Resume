import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const listSchema = z.object({
  name: z.string().min(1).max(120),
});

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
