import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { listVisits, getVisitCustomerOptions } from "@/lib/data/visits";
import { VisitsClient } from "@/components/visits/visits-client";

export const metadata: Metadata = { title: "Visits" };
export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const [visits, customers] = await Promise.all([listVisits(60), getVisitCustomerOptions()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Field visits</h1>
          <p className="text-xs text-muted-foreground">Plan and track visits to your customers.</p>
        </div>
        <Link
          href="/visits"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create visit</span>
        </Link>
      </div>

      <VisitsClient visits={visits} customers={customers} />
    </div>
  );
}