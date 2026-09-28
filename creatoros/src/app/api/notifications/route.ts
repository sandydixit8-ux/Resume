import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { listNotifications, unreadCount } from "@/lib/notifications/engine";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  return ok({ notifications: listNotifications(s.org.id, s.user.id), unread: unreadCount(s.org.id, s.user.id) });
}