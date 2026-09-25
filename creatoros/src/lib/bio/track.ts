import { trackEvent, newVisitorId } from "@/lib/analytics/engine";
import { getClientIp, userAgentInfo } from "@/lib/http";
import type { PublicBioPage } from "@/lib/bio/page";

/**
 * First-party server-side page-view tracking.
 * No third-party pixels; visitor id hashed and not stored long-term.
 */
export function trackPublicView(bio: PublicBioPage, _username: string): void {
  try {
    trackEvent({
      tenantId: bio.tenantId,
      pageId: bio.page.id,
      eventType: "page_view",
      visitorId: newVisitorId(),
      device: "server",
    });
  } catch {
    // tracking must never break the page render
  }
}

export function trackLinkClick(bio: PublicBioPage, url: string): void {
  try {
    trackEvent({
      tenantId: bio.tenantId,
      pageId: bio.page.id,
      eventType: "link_click",
      ref: url.slice(0, 500),
    });
  } catch {
    // non-fatal
  }
}