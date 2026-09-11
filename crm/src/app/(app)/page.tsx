import Link from "next/link";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getUserContext } from "@/lib/auth";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, humanize } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/utils";
import {
  Users,
  Flame,
  CalendarClock,
  GitBranch,
  ShoppingCart,
  IndianRupee,
  Package,
  Truck,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { getPipelineMini } from "@/lib/data/pipeline";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, ctx] = await Promise.all([getDashboardStats(), getUserContext()]);
  const isOwner = ctx.roleSlugs.includes("BUSINESS_OWNER") || ctx.roleSlugs.includes("ADMIN");
  const isManager = ctx.roleSlugs.includes("SALES_MANAGER");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            {ctx.user?.full_name.split(" ")[0]}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isOwner ? "Your business at a glance" : isManager ? "Your team's performance" : "Your day at a glance"} ·{" "}
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="hidden items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[var(--primary-hover)] sm:flex"
        >
          <Plus className="h-4 w-4" />
          Add lead
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total leads" value={formatNumber(stats.totalLeads)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Hot leads" value={formatNumber(stats.hotLeads)} icon={<Flame className="h-4 w-4 text-[var(--destructive)]" />} />
        <KpiCard label="New leads" value={formatNumber(stats.newLeads)} />
        <KpiCard label="Follow-ups today" value={formatNumber(stats.followupsToday)} hint="today" icon={<CalendarClock className="h-4 w-4" />} />
        {stats.followupsOverdue > 0 ? (
          <KpiCard label="Overdue follow-ups" value={formatNumber(stats.followupsOverdue)} hint="needs attention" />
        ) : null}
        <KpiCard label="Pipeline value" value={formatMoney(stats.pipelineValue)} icon={<GitBranch className="h-4 w-4" />} />
        <KpiCard label="Weighted pipeline" value={formatMoney(stats.weightedPipeline)} hint="value × probability" />
        <KpiCard label="Open opportunities" value={formatNumber(stats.openOpportunities)} />
        <KpiCard label="Revenue" value={formatMoney(stats.revenue)} icon={<IndianRupee className="h-4 w-4 text-[var(--success)]" />} />
        <KpiCard label="Outstanding" value={formatMoney(stats.outstanding)} hint={stats.outstanding > 0 ? "to collect" : "all clear"} />
        <KpiCard label="Pending orders" value={formatNumber(stats.pendingOrders)} icon={<ShoppingCart className="h-4 w-4" />} />
        <KpiCard label="Orders today" value={formatNumber(stats.ordersToday)} />
        <KpiCard label="Won deals" value={formatNumber(stats.wonDeals)} />
        <KpiCard label="Lost deals" value={formatNumber(stats.lostDeals)} />
        <KpiCard label="Low stock items" value={formatNumber(stats.lowStock)} icon={<Package className="h-4 w-4 text-[var(--warning)]" />} />
        <KpiCard label="Deliveries in progress" value={formatNumber(stats.deliveriesInProgress)} icon={<Truck className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Your pipeline</CardTitle>
              <CardDescription>Weighted value by stage</CardDescription>
            </div>
            <Link href="/pipeline" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
              Open <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <PipelineMini />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Focus today</CardTitle>
            <CardDescription>Follow-ups and tasks that need you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/tasks?view=overdue"
              className={`flex items-center justify-between rounded-lg border p-3 ${stats.followupsOverdue > 0 ? "border-red-200 bg-red-50" : "border-[var(--border)]"}`}
            >
              <span className="text-sm font-medium">{stats.followupsOverdue} overdue follow-ups</span>
              <Badge tone={stats.followupsOverdue > 0 ? "danger" : "neutral"}>
                {stats.followupsOverdue > 0 ? "Act now" : "All clear"}
              </Badge>
            </Link>
            <Link href="/tasks?view=today" className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
              <span className="text-sm font-medium">{stats.followupsToday} follow-ups today</span>
              <Badge tone="warning">{stats.followupsToday > 0 ? "Due" : "—"}</Badge>
            </Link>
            <Link href="/activities" className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
              <span className="text-sm font-medium">{stats.todayCalls} calls logged today</span>
              <Badge tone="info">{humanize("Today")}</Badge>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function PipelineMini() {
  const rows = await getPipelineMini();
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-sm font-medium">No open opportunities yet</p>
        <p className="text-xs text-muted-foreground">Add leads and move them through the pipeline to see forecast here.</p>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.stage_id}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">{r.stage_name}</span>
            <span className="tabular-nums text-muted-foreground">{formatMoney(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}