import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { listOrgs, planCursor } from "@/lib/admin/engine";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();
  return ok({ orgs: listOrgs(), plans: planCursor() });
}