import type { Metadata } from "next";
import { LEGAL_INFO } from "./legal-info";

/**
 * Shared shell for legal documents. The wording is a working draft prepared
 * for review by qualified counsel. Until it is reviewed and approved the pages
 * stay noindex and show a "pending review" notice.
 */
export function legalMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: true },
  };
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-navy-950">{title}</h1>
      <p className="mt-2 text-sm text-navy-500">Last updated: {LEGAL_INFO.effectiveDate}</p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Draft pending legal review.</p>
        <p className="mt-1 leading-relaxed">
          This is a working draft prepared for review by qualified counsel. It is not yet the
          published, binding version and its contents may change. Values shown in
          [square&nbsp;brackets] must be completed before launch.
        </p>
      </div>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-navy-800">{children}</div>
    </article>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy-950">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
