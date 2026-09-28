import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/auth/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/auth/register`, changeFrequency: "yearly", priority: 0.3 },
  ];
}