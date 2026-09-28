import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";

const schema = z.object({ subject: z.string().min(3).max(200), body: z.string().min(3).max(4000) });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  const id = newId("tkt");
  run(
    "INSERT INTO support_tickets (id, tenant_id, user_id, subject, body, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
    id,
    s.org.id,
    s.user.id,
    parsed.data.subject.trim(),
    parsed.data.body.trim(),
    nowIso()
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "support.create", resource: id, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ id });
}