import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";
import { listLeads, getLeadSources } from "@/lib/data/leads";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, priorityTone, leadStatusTone, humanize } from "@/components/ui/badge";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate, cn, initials } from "@/lib/utils";
import { searchParamsSchema } from "@/lib/validators";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = searchParamsSchema.safeParse(sp);
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const sources = await getLeadSources();

  const { leads, total, page, pageSize, ownerNames } = await listLeads({
    page: parsed.success ? parsed.data.page : 1,
    pageSize: parsed.success ? parsed.data.pageSize : 20,
    status: typeof sp.status === "string" ? sp.status : undefined,
    priority: typeof sp.priority === "string" ? sp.priority : undefined,
    source: typeof sp.source === "string" ? sp.source : undefined,
    q,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <LeadsFilters sources={sources} />
        <Link
          href="/leads/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add lead</span>
        </Link>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No leads match your search" : "No leads yet"}
          description={
            q
              ? "Try a different name, company or mobile number."
              : "Create your first lead in under 30 seconds and it will show up here and in the pipeline."
          }
          action={
            <Link
              href="/leads/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add your first lead
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[11px] font-semibold text-[var(--primary)]">
                          {initials(lead.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{lead.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {lead.company ?? lead.lead_no}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="block text-xs">{lead.mobile ?? "—"}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{lead.city ?? ""}</span>
                    </TableCell>
                    <TableCell>
                      <Badge>{lead.source}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm font-medium">{formatMoney(lead.value)}</TableCell>
                    <TableCell className="hidden text-xs md:table-cell">
                      {lead.owner_id ? ownerNames[lead.owner_id] ?? "—" : <span className="text-muted-foreground">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge tone={leadStatusTone(lead.status)}>{humanize(lead.status)}</Badge>
                        <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className={cn("hidden text-xs sm:table-cell", new Date(lead.next_followup_at ?? 0).getTime() < Date.now() && lead.status !== "WON" && lead.status !== "LOST" ? "text-[var(--destructive)]" : "")}>
                      {formatDate(lead.next_followup_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </div>
  );
}