import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/api/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
