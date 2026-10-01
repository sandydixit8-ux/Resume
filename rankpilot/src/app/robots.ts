import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const site = siteUrl();

/**
 * Only public marketing and legal surfaces are crawlable. Every authenticated
 * page (/app/*), the onboarding funnel, and the whole API are disallowed —
 * they either need a session or return JSON that has no business in an index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/api/",
          "/onboarding",
          "/login",
          "/register",
          "/logout",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
