import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { deletePost } from "@/lib/community/engine";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; postId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:write")) return err.forbidden();
  const { postId } = await ctx.params;

  const manager = s.role === "owner" || s.role === "admin";
  const deleted = deletePost(s.org.id, s.user.id, postId, manager);
  if (!deleted) return err.notFound();
  return ok({ deleted: true });
}