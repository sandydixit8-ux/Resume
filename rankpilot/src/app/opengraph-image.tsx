import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/site-url";

/**
 * Open Graph / Twitter card image.
 *
 * Generated rather than shipped as a binary in public/ so the brand colours stay
 * in one place and there is no 100 KB opaque asset to keep in sync. Next.js
 * picks this up automatically at /opengraph-image.
 *
 * The metadata in the root layout references /opengraph-image.png, which is the
 * path this file is served from.
 *
 * Note: Satori (the renderer behind ImageResponse) supports a subset of CSS --
 * flexbox only, no grid, and every element with more than one child needs an
 * explicit display value.
 */
export const runtime = "nodejs";
export const alt = "RankPilot AI — AI Growth Operating System";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage(): ImageResponse {
  const site = siteUrl();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1d4ed8 100%)",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2563eb",
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 20,
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 600,
            }}
          >
            RankPilot AI
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            AI-Powered SEO, GEO, AEO &amp; Social Growth
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              color: "#bfdbfe",
              fontSize: 30,
            }}
          >
            Analyse opportunities, create content, grow reach.
          </div>
        </div>

        <div style={{ display: "flex", color: "#93c5fd", fontSize: 24 }}>
          {site.replace(/^https?:\/\//, "")}
        </div>
      </div>
    ),
    size
  );
}
