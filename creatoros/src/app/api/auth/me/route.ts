import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { all, row } from "@/lib/db/db";
import { getLimits } from "@/lib/plans";
import { allUsage } from "@/lib/usage";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const profile = row("SELECT * FROM profiles WHERE tenant_id = ? AND user_id = ?", s.org.id, s.user.id);
  const bioPages = all("SELECT id, slug, title, published FROM bio_pages WHERE tenant_id = ? ORDER BY updated_at DESC", s.org.id);
  const services = all("SELECT COUNT(*) AS c FROM services WHERE tenant_id = ? AND active = 1", s.org.id);
  const contacts = all("SELECT COUNT(*) AS c FROM contacts WHERE tenant_id = ?", s.org.id);
  const bookings = all("SELECT COUNT(*) AS c FROM bookings WHERE tenant_id = ? AND status = 'confirmed'", s.org.id);

  const limits = getLimits(s.org.plan);
  const usage = allUsage(s.org.id);

  return ok({
    user: s.user,
    org: s.org,
    role: s.role,
    profile,
    bioPages,
    counts: {
      services: services[0]?.c ?? 0,
      contacts: contacts[0]?.c ?? 0,
      bookings: bookings[0]?.c ?? 0,
    },
    plan: {
      name: s.org.plan,
      limits,
      usage,
    },
  });
}