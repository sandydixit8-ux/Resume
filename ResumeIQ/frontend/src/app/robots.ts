import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/results", "/dashboard"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
