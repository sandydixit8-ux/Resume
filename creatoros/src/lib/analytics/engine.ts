import { all, run, newId, nowIso, type SQLParam } from "@/lib/db/db";
import { createHash, randomBytes } from "node:crypto";

const VISITOR_SALT = process.env.VISITOR_SALT || "creatoros-visitor";

export type EventType = "page_view" | "lead" | "booking" | "link_click";

export interface TrackEventInput {
  tenantId: string;
  pageId?: string;
  eventType: EventType;
  visitorId?: string;
  ref?: string;
  utmSource?: string;
  utmCampaign?: string;
  device?: string;
  country?: string;
}

export function trackEvent(input: TrackEventInput): void {
  run(
    "INSERT INTO analytics_events (id, tenant_id, page_id, event_type, visitor_id, ref, utm_source, utm_campaign, device, country, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId("evt"),
    input.tenantId,
    input.pageId ?? null,
    input.eventType,
    input.visitorId ?? "",
    input.ref ?? "",
    input.utmSource ?? "",
    input.utmCampaign ?? "",
    input.device ?? "",
    input.country ?? "",
    nowIso()
  );
}

/** Generate a privacy-safe visitor id from raw identifier + tenant secret. */
export function hashVisitorId(raw: string): string {
  const salted = `${raw}:${VISITOR_SALT}`;
  return createHash("sha256").update(salted).digest("hex").slice(0, 32);
}

export function newVisitorId(): string {
  return randomBytes(16).toString("hex");
}

export interface AnalyticsSummary {
  visitors: number;
  pageViews: number;
  leads: number;
  bookings: number;
  conversions: number;
  conversionRate: number;
  revenueCents: number;
  linkClicks: number;
}

export function summary(tenantId: string, days = 30): AnalyticsSummary {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const q = (sql: string, ...p: SQLParam[]): number => Number(all<{ c: number | string }>(sql, ...p)[0]?.c ?? 0);

  const visitors = Number(q("SELECT COUNT(DISTINCT visitor_id) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND visitor_id != ''", tenantId, since));
  const pageViews = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'page_view'", tenantId, since));
  const leads = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'lead'", tenantId, since));
  const bookingsCount = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'booking'", tenantId, since));
  const linkClicks = Number(q("SELECT COUNT(*) AS c FROM analytics_events WHERE tenant_id = ? AND created_at >= ? AND event_type = 'link_click'", tenantId, since));
  const revenueCents = Number(q("SELECT COALESCE(SUM(s.price_cents), 0) AS c FROM bookings b JOIN services s ON s.id = b.service_id WHERE b.tenant_id = ? AND b.created_at >= ? AND b.status = 'confirmed'", tenantId, since));

  return {
    visitors,
    pageViews,
    leads,
    bookings: bookingsCount,
    conversions: leads + bookingsCount,
    conversionRate: pageViews > 0 ? Math.round(((leads + bookingsCount) / pageViews) * 1000) / 10 : 0,
    revenueCents: Number(revenueCents),
    linkClicks,
  };
}

export interface SeriesPoint {
  date: string;
  views: number;
  leads: number;
}

export function timeSeries(tenantId: string, days = 30): SeriesPoint[] {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = all<{ day: string; event_type: string; c: number }>(
    `SELECT substr(created_at, 1, 10) AS day, event_type, COUNT(*) AS c
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY substr(created_at, 1, 10), event_type
     ORDER BY day ASC`,
    tenantId,
    since
  );
  const map = new Map<string, SeriesPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    map.set(d, { date: d, views: 0, leads: 0 });
  }
  for (const r of rows) {
    const p = map.get(r.day);
    if (!p) continue;
    if (r.event_type === "page_view") p.views = Number(r.c);
    if (r.event_type === "lead") p.leads = Number(r.c);
  }
  return [...map.values()];
}

export function breakdownBy(tenantId: string, column: "ref" | "utm_source" | "device" | "country", days = 30): { label: string; count: number }[] {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const allowed: Record<string, string> = { ref: "ref", utm_source: "utm_source", device: "device", country: "country" };
  const col = allowed[column];
  if (!col) return [];
  return all<{ label: string; count: number }>(
    `SELECT COALESCE(NULLIF(TRIM(${col}), ''), 'direct') AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE tenant_id = ? AND created_at >= ?
     GROUP BY label ORDER BY count DESC LIMIT 10`,
    tenantId,
    since
  );
}