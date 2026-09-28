import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { toggleReaction } from "@/lib/community/engine";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string; postId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:read")) return err.forbidden();
  const { postId } = await ctx.params;

  try {
    const result = toggleReaction(s.org.id, s.user.id, postId);
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message === "post_not_found") return err.notFound();
    return err.server();
  }
}