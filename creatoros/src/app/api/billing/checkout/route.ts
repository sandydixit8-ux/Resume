import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err } from "@/lib/http";
import { run, row } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";
import { PLANS } from "@/lib/plans";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "billing:write")) return err.forbidden();

  const plan = (req.nextUrl.searchParams.get("plan") || "").toLowerCase();
  if (!PLANS[plan]) return err.validation({ plan: "Unknown plan" });

  // Billing is plan-gated in the data model (plans_usage) but checkout is
  // simulated in dev until a payment provider is wired in production.
  const org = row("SELECT id FROM organizations WHERE id = ?", s.org.id);
  if (!org) return err.notFound();
  run("UPDATE organizations SET plan = ? WHERE id = ?", plan, s.org.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "billing.plan_change", resource: plan, ip: req.headers.get("x-forwarded-for") || undefined });
  return Response.redirect(new URL("/app/billing?upgraded=" + plan, req.url), 303);
}