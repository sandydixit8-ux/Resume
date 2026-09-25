import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, readJson, getClientIp, userAgentInfo } from "@/lib/http";
import { getPublicBioPage } from "@/lib/bio/page";
import { trackEvent, hashVisitorId, newVisitorId } from "@/lib/analytics/engine";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";

const trackSchema = z.object({
  username: z.string().min(1).max(60),
  pageSlug: z.string().default(""),
  eventType: z.enum(["page_view", "link_click"]).default("page_view"),
  ref: z.string().max(500).default(""),
  utm_source: z.string().max(100).default(""),
  utm_campaign: z.string().max(100).default(""),
  visitorId: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("track", ip), 120);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const bio = getPublicBioPage(parsed.data.username, parsed.data.pageSlug);
  if (!bio) return err.notFound();

  const { device, ref } = userAgentInfo(req);
  const visitorId = parsed.data.visitorId ? hashVisitorId(parsed.data.visitorId) : newVisitorId();

  trackEvent({
    tenantId: bio.tenantId,
    pageId: bio.page.id,
    eventType: parsed.data.eventType,
    visitorId: parsed.data.visitorId ? visitorId : "",
    ref: parsed.data.ref || ref,
    utmSource: parsed.data.utm_source,
    utmCampaign: parsed.data.utm_campaign,
    device,
  });

  return ok({ visitorId: parsed.data.visitorId ? visitorId : undefined, tracked: true });
}