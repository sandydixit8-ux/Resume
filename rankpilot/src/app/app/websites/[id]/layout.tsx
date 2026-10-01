import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { WebsiteTabs } from "@/components/website";

export const dynamic = "force-dynamic";

export default async function WebsiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-0">
      <div className="mb-4">
        <div className="text-xs text-ink-400">
          <Link href="/app/websites" className="hover:text-brand-600">Websites</Link> / {website.name}
        </div>
        <h1 className="truncate text-xl font-semibold text-ink-900">{website.name}</h1>
        <a
          href={website.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm text-ink-500 hover:text-brand-600"
        >
          {website.normalized_url} ↗
        </a>
      </div>
      <WebsiteTabs websiteId={website.id} />
      <div className="pt-5">{children}</div>
    </div>
  );
}
