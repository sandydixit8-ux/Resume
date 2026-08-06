import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = [
    "",
    "/analyze",
    "/builder",
    "/cover-letter",
    "/interview",
    "/jd-match",
    "/pricing",
    "/recruiter",
  ]
  return routes.map((r) => ({
    url: `${siteUrl}${r}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: r === "" ? 1 : 0.8,
  }))
}
