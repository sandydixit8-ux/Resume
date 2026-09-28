import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { getLimits, withinLimit } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const serviceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  durationMin: z.number().int().min(5).max(480),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("usd"),
  bufferMin: z.number().int().min(0).max(120).default(0),
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
});

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const services = all(
    "SELECT id, name, description, duration_min, price_cents, currency, buffer_min, active, slug FROM services WHERE tenant_id = ? ORDER BY created_at ASC",
    s.org.id
  );
  const availability = all(
    "SELECT id, service_id, day_of_week, start_min, end_min FROM availability_windows WHERE tenant_id = ? ORDER BY service_id, day_of_week",
    s.org.id
  );
  const bookings = all(
    "SELECT id, service_id, attendee_name, attendee_email, starts_at, ends_at, status, created_at FROM bookings WHERE tenant_id = ? ORDER BY starts_at DESC LIMIT 100",
    s.org.id
  );
  return ok({ services, availability, bookings });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "booking:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const dup = row("SELECT id FROM services WHERE tenant_id = ? AND slug = ?", s.org.id, parsed.data.slug);
  if (dup) return err.conflict("A service with this slug already exists");

  const limits = getLimits(s.org.plan);
  const usedServices = getUsage(s.org.id, "services");
  if (!withinLimit(usedServices, limits.services)) {
    return err.conflict(`Service limit reached for the ${s.org.plan} plan. Upgrade to add more.`);
  }

  const id = newId("svc");
  run(
    "INSERT INTO services (id, tenant_id, name, description, duration_min, price_cents, currency, buffer_min, active, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
    id,
    s.org.id,
    parsed.data.name,
    parsed.data.description,
    parsed.data.durationMin,
    parsed.data.priceCents,
    parsed.data.currency,
    parsed.data.bufferMin,
    parsed.data.slug,
    nowIso(),
    nowIso()
  );
  bumpUsage(s.org.id, "services");
  audit({ tenantId: s.org.id, userId: s.user.id, action: "booking.service_create", resource: id, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ serviceId: id });
}