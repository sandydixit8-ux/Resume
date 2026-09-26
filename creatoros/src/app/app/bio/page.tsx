import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getProfileForUser } from "@/lib/bio/page";
import { all } from "@/lib/db/db";
import { BioPagesList } from "@/components/bio/bio-pages-list";
import { BioCreateButton } from "@/components/bio/bio-create-button";

export const dynamic = "force-dynamic";

export default async function BioPagesPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const profile = getProfileForUser(s.org.id, s.user.id);
  const pages = all<{ id: string; slug: string; title: string; published: number }>(
    "SELECT id, slug, title, published FROM bio_pages WHERE tenant_id = ? ORDER BY updated_at DESC",
    s.org.id
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Bio Pages</h1>
          <p className="mt-1 text-sm text-navy-500">Your link-in-bio storefront. Share it everywhere.</p>
        </div>
        <BioCreateButton />
      </div>
      <BioPagesList pages={pages} username={profile?.username ?? ""} />
    </div>
  );
}