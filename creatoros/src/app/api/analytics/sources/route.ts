import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { breakdownBy } from "@/lib/analytics/engine";
import { can } from "@/lib/auth/rbac";

const COLUMNS = ["ref", "utm_source", "device", "country"] as const;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  const colParam = req.nextUrl.searchParams.get("by") || "ref";
  const col = (COLUMNS as readonly string[]).includes(colParam) ? (colParam as (typeof COLUMNS)[number]) : "ref";
  const days = clamp(parseInt(req.nextUrl.searchParams.get("days") || "30", 10));

  const parts = COLUMNS.map((c) => ({ by: c, data: breakdownBy(s.org.id, c, days) }));
  return ok({ selected: col, parts });
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 30;
  return Math.min(365, Math.max(1, n));
}