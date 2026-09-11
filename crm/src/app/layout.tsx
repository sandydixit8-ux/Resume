import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VyaparOne CRM",
    template: "%s · VyaparOne CRM",
  },
  description:
    "Mobile-first CRM for Indian SMBs: leads, pipeline, follow-ups, orders, inventory, billing and WhatsApp in one place.",
  applicationName: "VyaparOne CRM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ea6a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
