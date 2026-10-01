import { ImageResponse } from "next/og";

/**
 * Favicon, generated at /icon. Without this the browser requests /favicon.ico,
 * gets a 404, and every tab shows a broken page icon.
 *
 * Marked static so it is baked at build time rather than rendered per request.
 */
export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 8,
        }}
      >
        R
      </div>
    ),
    size
  );
}
