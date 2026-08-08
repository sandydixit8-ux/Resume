import { ImageResponse } from "next/og"

export const alt = "ResumeIQ AI — Analyze. Optimize. Get Hired."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #041c12 0%, #052e22 55%, #0a3d33 100%)",
          color: "#ecfdf5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "linear-gradient(135deg, #10b981, #06b6d4)",
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 900 }}>R</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: 1 }}>ResumeIQ AI</span>
            <span style={{ fontSize: 28, color: "#a7f3d0" }}>Analyze. Optimize. Get Hired.</span>
          </div>
        </div>
        <span style={{ fontSize: 26, color: "#6ee7b7", textAlign: "center", padding: "0 80px" }}>
          AI resume analysis, ATS scoring, JD matching, cover letters &amp; interview prep
        </span>
      </div>
    ),
    { ...size }
  )
}
