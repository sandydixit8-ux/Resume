import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLeadDetail } from "@/lib/data/lead-detail";
import { getAssignableUsers } from "@/lib/data/leads";
import { LeadDetailClient } from "@/components/leads/lead-detail-client";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, assignableUsers] = await Promise.all([getLeadDetail(id), getAssignableUsers()]);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <Link href="/leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to leads
      </Link>
      <LeadDetailClient
        lead={detail.lead}
        ownerName={detail.ownerName}
        createdByName={detail.createdByName}
        activities={detail.activities}
        followups={detail.followups}
        quotations={detail.quotations}
        messages={detail.messages}
        assignableUsers={assignableUsers}
      />
    </div>
  );
}