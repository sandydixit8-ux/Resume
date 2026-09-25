import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { row, all } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "leads:read")) return err.forbidden();

  const search = req.nextUrl.searchParams;
  const page = Math.max(1, Number(search.get("page") || 1));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  const total = (row<{ c: number }>("SELECT COUNT(*) AS c FROM contacts WHERE tenant_id = ?", s.org.id) as { c: number }).c;
  const contacts = all<{ id: string; email: string; name: string; consent: number; source: string; utm_source: string; utm_campaign: string; tags: string; created_at: string }>(
    "SELECT id, email, name, consent, source, utm_source, utm_campaign, tags, created_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    s.org.id,
    perPage,
    offset
  );

  return ok({ contacts, total, page, perPage });
}