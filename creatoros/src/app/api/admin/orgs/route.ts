import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { listOrgs, setOrgPlan, planCursor } from "@/lib/admin/engine";

const orgSchema = z.object({ plan: z.string().min(1) });

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();
  return ok({ orgs: listOrgs(), plans: planCursor() });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();
  const { orgId } = await ctx.params;
  const parsed = orgSchema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  try {
    setOrgPlan(s.user.id, orgId, parsed.data.plan);
    return ok({ updated: true });
  } catch (e) {
    return err.conflict(e instanceof Error ? e.message : "bad request");
  }
}