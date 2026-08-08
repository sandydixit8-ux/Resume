import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"
  const now = new Date()
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/analyze`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/builder`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/jd-match`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/cover-letter`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/interview`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/recruiter`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ]
}
