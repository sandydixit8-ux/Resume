import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { BookingManager } from "@/components/booking/manager";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const services = all<{
    id: string;
    name: string;
    description: string;
    duration_min: number;
    price_cents: number;
    currency: string;
    buffer_min: number;
    active: number;
    slug: string;
  }>("SELECT id, name, description, duration_min, price_cents, currency, buffer_min, active, slug FROM services WHERE tenant_id = ? ORDER BY created_at ASC", s.org.id);

  const availability = all<{
    id: string;
    service_id: string;
    day_of_week: number;
    start_min: number;
    end_min: number;
  }>("SELECT id, service_id, day_of_week, start_min, end_min FROM availability_windows WHERE tenant_id = ? ORDER BY service_id, day_of_week", s.org.id);

  const bookings = all<{
    id: string;
    service_id: string;
    attendee_name: string;
    attendee_email: string;
    starts_at: string;
    ends_at: string;
    status: string;
    created_at: string;
  }>("SELECT id, service_id, attendee_name, attendee_email, starts_at, ends_at, status, created_at FROM bookings WHERE tenant_id = ? ORDER BY starts_at DESC LIMIT 50", s.org.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Booking</h1>
          <p className="mt-1 text-sm text-navy-500">Offer calls &amp; sessions. People book straight from your bio page.</p>
        </div>
        <Link href="/app/analytics" className="btn-secondary">
          <CalendarCheck className="h-4 w-4" /> Booking analytics
        </Link>
      </div>

      <BookingManager initialServices={services} initialAvailability={availability} initialBookings={bookings} />
    </div>
  );
}