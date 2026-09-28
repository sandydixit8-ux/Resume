import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { markNotificationRead, markAllRead } from "@/lib/notifications/engine";
import { audit } from "@/lib/audit";

const readSchema = z.object({ id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const body = await readJson(req);
  const parsed = readSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  const changed = markNotificationRead(s.org.id, s.user.id, parsed.data.id);
  if (!changed) return err.notFound();
  audit({ tenantId: s.org.id, userId: s.user.id, action: "notifications.read", ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ read: true });
}

export async function PUT(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const count = markAllRead(s.org.id, s.user.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "notifications.read_all", ip: _req.headers.get("x-forwarded-for") || undefined });
  return ok({ marked: count });
}