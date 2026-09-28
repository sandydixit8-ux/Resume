import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { PREMIUM_PLANS, listTemplates, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { TemplateCard, type TemplateCardData } from "@/components/templates/template-card";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ category?: string; q?: string }> };

export default async function TemplatesPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const sp = await searchParams;
  const category = sp.category ?? "";
  const q = sp.q ?? "";

  const templates = listTemplates(category, q);
  const premiumUnlocked = PREMIUM_PLANS.has(s.org.plan);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Template Library</h1>
          <p className="mt-1 text-sm text-navy-500">Start from a proven layout and make it yours in minutes.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {!premiumUnlocked && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Premium templates unlock on the Creator plan
            </span>
          )}
          <Link href="/app/bio" className="btn-secondary">
            My bio pages
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app/templates" className={`rounded-full px-3 py-1.5 text-sm font-medium ${!category ? "bg-brand-600 text-white" : "bg-white text-navy-600 ring-1 ring-navy-200 hover:bg-navy-50"}`}>
          All
        </Link>
        {TEMPLATE_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/app/templates?category=${c}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${category === c ? "bg-brand-600 text-white" : "bg-white text-navy-600 ring-1 ring-navy-200 hover:bg-navy-50"}`}
          >
            {c}
          </Link>
        ))}
      </div>

      {templates.length === 0 ? (
        <div className="card p-10 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-navy-300" />
          <h2 className="mt-3 font-semibold text-navy-900">No templates match</h2>
          <p className="mt-1 text-sm text-navy-500">Try a different category or clear your search.</p>
          <Link href="/app/templates" className="btn-primary mt-4">Browse all templates</Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t as TemplateCardData} locked={t.premium && !premiumUnlocked} />
          ))}
        </div>
      )}
    </div>
  );
}