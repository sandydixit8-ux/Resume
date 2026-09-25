import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "CreatorOS — Create. Grow. Sell. Automate. All in One Place.",
    template: "%s | CreatorOS",
  },
  description: "The all-in-one creator & business monetization operating system: link-in-bio store, booking, courses, analytics, AI growth coach, email and more.",
  openGraph: {
    type: "website",
    title: "CreatorOS — Create. Grow. Sell. Automate.",
    description: "The all-in-one creator monetization operating system.",
    siteName: "CreatorOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "CreatorOS — Create. Grow. Sell. Automate.",
    description: "The all-in-one creator monetization operating system.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}