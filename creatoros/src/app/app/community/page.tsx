import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle, UsersRound } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { listCommunities } from "@/lib/community/engine";
import { CreateCommunity } from "@/components/community/create-community";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const communities = listCommunities(s.org.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Community</h1>
        <p className="mt-1 text-sm text-navy-500">A members-only space for your audience to connect.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {communities.length === 0 ? (
            <div className="card p-10 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-navy-300" />
              <h2 className="mt-3 font-semibold text-navy-900">No communities yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">
                Create a community and share a link with your followers. Members post updates, react and comment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {communities.map((c) => (
                <Link key={c.id} href={`/app/community/${c.id}`} className="card block p-5 transition-colors hover:border-brand-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-navy-900">{c.name}</h2>
                      {c.description && <p className="mt-1 text-sm text-navy-500">{c.description}</p>}
                    </div>
                    <div className="shrink-0 text-right text-xs text-navy-400">
                      <div className="flex items-center justify-end gap-1"><UsersRound className="h-3.5 w-3.5" /> {c.member_count} members</div>
                      <div className="mt-1 flex items-center justify-end gap-1"><MessageCircle className="h-3.5 w-3.5" /> {c.post_count} posts</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          {can(s.role as never, "community:write") ? (
            <CreateCommunity />
          ) : (
            <div className="card p-5 text-sm text-navy-500">You need editor access or above to create communities.</div>
          )}
        </div>
      </div>
    </div>
  );
}