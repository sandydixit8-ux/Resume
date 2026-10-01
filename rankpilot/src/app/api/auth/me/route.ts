import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { usageReport } from "@/lib/usage";
import { nowIso, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  return ok({
    user: s.user,
    org: s.org,
    role: s.role,
    plan: s.org.plan,
    usage: usageReport(s.org.id, s.org.plan),
  });
}

const patchSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  run("UPDATE users SET name = ?, updated_at = ? WHERE id = ?", parsed.data.name, nowIso(), s.user.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "user.profile_update", entity: "user", entityId: s.user.id });
  return ok({ user: { ...s.user, name: parsed.data.name } });
}
