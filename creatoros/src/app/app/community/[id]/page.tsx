import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { getCommunity, feed } from "@/lib/community/engine";
import { CommunityFeed } from "@/components/community/community-feed";
import { DeleteCommunityButton } from "@/components/community/delete-community-button";

export const dynamic = "force-dynamic";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) redirect("/auth/login");
  const { id } = await params;

  const community = getCommunity(s.org.id, id);
  if (!community) redirect("/app/community");

  const manager = s.role === "owner" || s.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link href="/app/community" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
            <ArrowLeft className="h-4 w-4" /> All communities
          </Link>
          <h1 className="text-2xl font-bold text-navy-950">{community.name}</h1>
          {community.description && <p className="mt-1 text-sm text-navy-500">{community.description}</p>}
          <p className="mt-1 text-xs text-navy-400">{community.member_count} members · {community.post_count} posts</p>
        </div>
        {manager && <DeleteCommunityButton communityId={id} name={community.name} />}
      </div>

      <CommunityFeed
        communityId={id}
        initialPosts={feed(s.org.id, s.user.id, id)}
        currentUserId={s.user.id}
        manager={can(s.role as never, "community:write") && manager}
      />
    </div>
  );
}