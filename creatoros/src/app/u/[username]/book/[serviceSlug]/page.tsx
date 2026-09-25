import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBioPage } from "@/lib/bio/page";
import { row, all } from "@/lib/db/db";
import { SITE_URL } from "@/lib/constants";
import { PublicBookingClient } from "@/components/booking/public-booking";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string; serviceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, serviceSlug } = await params;
  const bio = getPublicBioPage(username);
  const service = bio
    ? row<{ name: string }>("SELECT name FROM services WHERE tenant_id = ? AND slug = ? AND active = 1", bio.tenantId, serviceSlug)
    : null;
  if (!bio || !service) return { title: "Booking" };
  return {
    title: `Book ${service.name} with ${bio.profile.displayName || bio.profile.username}`,
    description: `Schedule a session with ${bio.profile.displayName || bio.profile.username}.`,
    alternates: { canonical: `${SITE_URL}/@${username}/book/${serviceSlug}` },
  };
}

export default async function PublicBookingPage({ params }: Props) {
  const { username, serviceSlug } = await params;
  const bio = getPublicBioPage(username);
  if (!bio) notFound();

  const service = row<{
    id: string;
    name: string;
    description: string;
    duration_min: number;
    price_cents: number;
    currency: string;
    buffer_min: number;
  }>("SELECT id, name, description, duration_min, price_cents, currency, buffer_min FROM services WHERE tenant_id = ? AND slug = ? AND active = 1", bio.tenantId, serviceSlug);
  if (!service) notFound();

  const windows = all<{ day_of_week: number; start_min: number; end_min: number }>(
    "SELECT day_of_week, start_min, end_min FROM availability_windows WHERE service_id = ?",
    service.id
  );

  return (
    <PublicBookingClient
      username={username}
      pageSlug={bio.page.slug}
      service={{
        id: service.id,
        name: service.name,
        description: service.description,
        durationMin: service.duration_min,
        priceCents: service.price_cents,
        currency: service.currency,
        bufferMin: service.buffer_min,
        slug: serviceSlug,
      }}
      windows={windows}
      ownerTz={bio.profile.timezone || "UTC"}
      creatorName={bio.profile.displayName || bio.profile.username}
    />
  );
}