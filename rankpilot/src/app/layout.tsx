import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import { organizationJsonLd, softwareApplicationJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const site = siteUrl();

export const metadata: Metadata = {
  // Enables Next.js to resolve every relative URL in the metadata below without
  // each one needing to be absolute by hand.
  metadataBase: new URL(site),
  title: {
    default: "RankPilot AI — AI-Powered SEO, GEO, AEO & Social Growth Engine",
    template: "%s | RankPilot AI",
  },
  description:
    "Analyze SEO, AEO and GEO opportunities, create high-performing content, grow social reach and continuously improve your digital visibility.",
  // Without this, a page inherits the site root as its canonical, which tells a
  // search engine that /pricing and /legal/terms are duplicates of the homepage.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site,
    siteName: "RankPilot AI",
    title: "RankPilot AI — AI Growth Operating System",
    description:
      "Analyze SEO, AEO and GEO opportunities, create high-performing content and grow social reach.",
    images: [{ url: absoluteUrl("/opengraph-image.png"), width: 1200, height: 630, alt: "RankPilot AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RankPilot AI — AI Growth Operating System",
    description:
      "Analyze SEO, AEO and GEO opportunities, create high-performing content and grow social reach.",
    images: [absoluteUrl("/opengraph-image.png")],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans`}>
        {/* Organization + SoftwareApplication structured data. Kept in the root
            layout so every page inherits it; the per-page SoftwareApplication
            block adds a @id that links to the Organization node. */}
        <script
          type="application/ld+json"
          // Serialised from our own typed objects, with `<` escaped so a
          // description containing "</script>" cannot break out of the tag.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd([organizationJsonLd(), softwareApplicationJsonLd()]) }}
        />
        {children}
      </body>
    </html>
  );
}
