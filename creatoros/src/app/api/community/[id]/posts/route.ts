import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { createPost } from "@/lib/community/engine";

const postSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:write")) return err.forbidden();
  const { id } = await ctx.params;

  const body = await readJson(req);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  try {
    const { id: postId } = createPost(s.org.id, s.user.id, id, parsed.data.body);
    return ok({ id: postId });
  } catch (e) {
    if (e instanceof Error && e.message === "community_not_found") return err.notFound();
    return err.server();
  }
}