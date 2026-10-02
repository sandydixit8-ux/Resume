import type { Metadata } from "next";

/**
 * Shared shell for legal documents. The real wording must be supplied and
 * approved by legal/business before launch; this component only renders a
 * clearly-marked placeholder so the routes and links exist and are testable.
 */
export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-navy-950">{title}</h1>
      <p className="mt-2 text-sm text-navy-500">Last updated: pending legal review</p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p className="font-semibold">This page is a placeholder.</p>
        <p className="mt-1 leading-relaxed">
          The approved {title} has not been published yet. Nothing on this page is a legal agreement or
          legal advice, and its contents may change. The final, reviewed version will replace this notice
          before launch.
        </p>
      </div>
    </article>
  );
}

export function legalMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: true },
  };
}
