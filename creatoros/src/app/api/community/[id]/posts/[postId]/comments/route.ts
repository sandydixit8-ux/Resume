import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { comments, createComment } from "@/lib/community/engine";

const commentSchema = z.object({
  body: z.string().min(1).max(1000),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; postId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:read")) return err.forbidden();
  const { postId } = await ctx.params;
  return ok({ comments: comments(s.org.id, postId) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; postId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:write")) return err.forbidden();
  const { postId } = await ctx.params;

  const body = await readJson(req);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  try {
    const { id } = createComment(s.org.id, s.user.id, postId, parsed.data.body);
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "post_not_found") return err.notFound();
    return err.server();
  }
}