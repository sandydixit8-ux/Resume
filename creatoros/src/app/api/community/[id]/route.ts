import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { getCommunity, deleteCommunity, feed } from "@/lib/community/engine";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:read")) return err.forbidden();
  const { id } = await ctx.params;

  const community = getCommunity(s.org.id, id);
  if (!community) return err.notFound();
  return ok({ community, posts: feed(s.org.id, s.user.id, id) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:write")) return err.forbidden();
  const { id } = await ctx.params;

  const manager = s.role === "owner" || s.role === "admin";
  if (!manager) return err.forbidden();
  const deleted = deleteCommunity(s.org.id, s.user.id, id);
  if (!deleted) return err.notFound();
  return ok({ deleted: true });
}