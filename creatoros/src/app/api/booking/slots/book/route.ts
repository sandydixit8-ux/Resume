import { NextRequest } from "next/server";
import { z } from "zod";
import { err, ok, readJson, getClientIp } from "@/lib/http";
import { all, row, run, newId, nowIso, tx } from "@/lib/db/db";
import { getPublicBioPage } from "@/lib/bio/page";
import { computeSlots } from "@/lib/booking/slots";
import { trackEvent } from "@/lib/analytics/engine";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const bookSchema = z.object({
  username: z.string().min(1).max(60),
  serviceSlug: z.string().min(1).max(60),
  start: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid start time" }),
  attendeeName: z.string().min(1).max(120),
  attendeeEmail: z.string().email(),
  timezone: z.string().max(60).default("UTC"),
  notes: z.string().max(2000).default(""),
  visitorId: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("booking_create", ip), 20);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  const { username, serviceSlug, start, attendeeName, attendeeEmail, timezone, notes, visitorId } = parsed.data;

  const bio = getPublicBioPage(username);
  if (!bio) return err.notFound();

  const service = row<{ id: string; name: string; duration_min: number; buffer_min: number; price_cents: number }>(
    "SELECT id, name, duration_min, buffer_min, price_cents FROM services WHERE tenant_id = ? AND slug = ? AND active = 1",
    bio.tenantId,
    serviceSlug
  );
  if (!service) return err.notFound();

  const startMs = Date.parse(start);
  const endMs = startMs + service.duration_min * 60000;
  const startsIso = new Date(startMs).toISOString();
  const endsIso = new Date(endMs).toISOString();

  const ownerTz = bio.profile.timezone || "UTC";
  const windows = all<{ day_of_week: number; start_min: number; end_min: number }>(
    "SELECT day_of_week, start_min, end_min FROM availability_windows WHERE service_id = ?",
    service.id
  );
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: ownerTz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(startMs)
    .replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");

  const existing = all<{ starts_at: string; ends_at: string; status: string }>(
    "SELECT starts_at, ends_at, status FROM bookings WHERE service_id = ? AND status IN ('confirmed','rescheduled')",
    service.id
  );
  const openSlots = computeSlots({
    windows: windows.map((w) => ({ dayOfWeek: w.day_of_week, startMin: w.start_min, endMin: w.end_min })),
    existing,
    serviceDurationMin: service.duration_min,
    bufferMin: service.buffer_min,
    dateStr: localDate,
    ownerTz,
    requestorTz: timezone,
  });
  const isOpenStart = openSlots.some((s) => s.start === startsIso && s.end === endsIso);

  if (!isOpenStart) {
    return err.conflict("This slot is no longer available. Please pick another time.");
  }

  try {
    const booking = tx(() => {
      // re-check within transaction to prevent double booking
      const conflict = row<{ id: string }>(
        "SELECT id FROM bookings WHERE service_id = ? AND status IN ('confirmed','rescheduled') AND starts_at < ? AND ends_at > ?",
        service.id,
        endsIso,
        startsIso
      );
      if (conflict) return null;

      let contactId: string | null = null;
      const contact = row<{ id: string }>("SELECT id FROM contacts WHERE tenant_id = ? AND email = ?", bio.tenantId, attendeeEmail.toLowerCase());
      if (contact) {
        contactId = contact.id;
      } else {
        const cid = newId("con");
        run(
          "INSERT INTO contacts (id, tenant_id, email, name, consent, source, page_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 'booking', ?, '[]', ?, ?)",
          cid,
          bio.tenantId,
          attendeeEmail.toLowerCase(),
          attendeeName,
          bio.page.id,
          nowIso(),
          nowIso()
        );
        contactId = cid;
      }

      const bookingId = newId("bkg");
      run(
        "INSERT INTO bookings (id, tenant_id, service_id, contact_id, attendee_name, attendee_email, starts_at, ends_at, status, timezone, notes, reminder_sent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, 0, ?, ?)",
        bookingId,
        bio.tenantId,
        service.id,
        contactId,
        attendeeName,
        attendeeEmail.toLowerCase(),
        startsIso,
        endsIso,
        timezone,
        notes,
        nowIso(),
        nowIso()
      );
      return bookingId;
    });

    if (!booking) return err.conflict("That slot was just booked by someone else. Please pick another.");

    trackEvent({
      tenantId: bio.tenantId,
      pageId: bio.page.id,
      eventType: "booking",
      visitorId: visitorId ? visitorId.slice(0, 64) : "",
      utmSource: "",
      utmCampaign: "",
      device: "",
    });

    return ok({
      bookingId: booking,
      status: "confirmed",
      message: `You're booked ${new Date(startsIso).toLocaleString()}. Check your inbox for details.`,
    });
  } catch (e) {
    console.error("[booking/book]", e);
    return err.server();
  }
}