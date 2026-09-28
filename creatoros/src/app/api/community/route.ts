import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { listCommunities, createCommunity } from "@/lib/community/engine";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(""),
  public_flag: z.boolean().default(true),
});

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:read")) return err.forbidden();
  return ok({ communities: listCommunities(s.org.id) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "community:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const { id } = createCommunity(s.org.id, s.user.id, parsed.data);
  return ok({ id });
}