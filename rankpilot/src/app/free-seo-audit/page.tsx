import type { Metadata } from "next";
import FreeAuditForm from "./FreeAuditForm";

export const metadata: Metadata = {
  title: "Free SEO Audit — no account needed",
  description:
    "Run a free single-page growth audit. Get a score, your top SEO issues and quick wins. No account required.",
  // Without this the page inherits the root canonical of "/" and is treated as a
  // duplicate of the homepage.
  alternates: { canonical: "/free-seo-audit" },
  // Deliberately no page-level `openGraph`: Next merges metadata shallowly per
  // top-level key, so declaring one here replaces the root object wholesale and
  // loses the og:image. Omitting it lets the title and description above supply
  // og:title/og:description while the image is inherited.
  robots: { index: true, follow: true },
};

export default function FreeAuditPage() {
  return <FreeAuditForm />;
}
