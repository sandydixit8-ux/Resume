import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { summary } from "@/lib/analytics/engine";
import { can } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  const days = clamp(parseInt(req.nextUrl.searchParams.get("days") || "30", 10));
  return ok(summary(s.org.id, days));
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 30;
  return Math.min(365, Math.max(1, n));
}