import { NextRequest } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/http";
import { all, row } from "@/lib/db/db";
import { getPublicBioPage } from "@/lib/bio/page";
import { computeSlots, nextDays } from "@/lib/booking/slots";

const querySchema = z.object({
  username: z.string().min(1).max(60),
  serviceSlug: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tz: z.string().max(60).optional(),
});

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    username: search.get("username"),
    serviceSlug: search.get("serviceSlug"),
    date: search.get("date") || undefined,
    tz: search.get("tz") || undefined,
  });
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  const { username, serviceSlug, date, tz } = parsed.data;

  const bio = getPublicBioPage(username);
  if (!bio) return err.notFound();

  const service = row<{ id: string; name: string; description: string; duration_min: number; price_cents: number; currency: string; buffer_min: number; slug: string }>(
    "SELECT id, name, description, duration_min, price_cents, currency, buffer_min, slug FROM services WHERE tenant_id = ? AND slug = ? AND active = 1",
    bio.tenantId,
    serviceSlug
  );
  if (!service) return err.notFound();

  const windows = all<{ day_of_week: number; start_min: number; end_min: number }>(
    "SELECT day_of_week, start_min, end_min FROM availability_windows WHERE service_id = ?",
    service.id
  );

  const ownerTz = bio.profile.timezone || "UTC";
  const requestorTz = tz && isValidTimezone(tz) ? tz : ownerTz;

  if (date) {
    const existing = all<{ starts_at: string; ends_at: string; status: string }>(
      "SELECT starts_at, ends_at, status FROM bookings WHERE service_id = ? AND tenant_id = ?",
      service.id,
      bio.tenantId
    );
    const slots = computeSlots({
      windows: windows.map((w) => ({ dayOfWeek: w.day_of_week, startMin: w.start_min, endMin: w.end_min })),
      existing,
      serviceDurationMin: service.duration_min,
      bufferMin: service.buffer_min,
      dateStr: date,
      ownerTz,
      requestorTz,
    });
    return ok({ date, slots, service: { id: service.id, name: service.name, description: service.description, durationMin: service.duration_min, priceCents: service.price_cents, currency: service.currency, slug: service.slug }, ownerTz, requestorTz });
  }

  return ok({ dates: nextDays(14, ownerTz), service: { id: service.id, name: service.name, description: service.description, durationMin: service.duration_min, priceCents: service.price_cents, currency: service.currency, slug: service.slug }, ownerTz, requestorTz });
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}