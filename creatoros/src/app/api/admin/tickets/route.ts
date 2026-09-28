import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { isPlatformAdmin } from "@/lib/admin/access";
import { listOpenTickets, updateTicketStatus, VALID_TICKET_STATUSES } from "@/lib/admin/engine";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();
  return ok({ tickets: listOpenTickets(), statuses: VALID_TICKET_STATUSES });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isPlatformAdmin(s.user.email)) return err.forbidden();
  const { id } = await ctx.params;
  const parsed = z.object({ status: z.string().min(1) }).safeParse(await readJson(req));
  if (!parsed.success) return err.validation({ status: ["required"] });
  try {
    updateTicketStatus(s.user.id, id, parsed.data.status);
    return ok({ updated: true });
  } catch (e) {
    return err.conflict(e instanceof Error ? e.message : "bad request");
  }
}