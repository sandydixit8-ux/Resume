import { getSession } from "@/lib/auth/get-session";
import { all, row } from "@/lib/db/db";
import { Card, Badge } from "@/components/ui";
import { PLAN_PRICES } from "@/lib/plans";
import { ChangePlan } from "./change-plan";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const s = (await getSession())!;
  const sub = row<{ plan: string; status: string; period_end: string | null }>(
    "SELECT plan, status, period_end FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
    s.org.id
  );
  const invoices = all<{ id: string; amount_usd: number; currency: string; period: string; status: string; created_at: string }>(
    "SELECT id, amount_usd, currency, period, status, created_at FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 24",
    s.org.id
  );
  const plans = Object.entries(PLAN_PRICES).map(([id, p]) => [id, p.usd] as const);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Current plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-semibold text-ink-900">{sub?.plan ?? s.org.plan}</span>
            <Badge tone={sub?.status === "active" ? "completed" : "medium"}>{sub?.status ?? "active"}</Badge>
          </div>
          {sub?.period_end ? (
            <div className="text-xs text-ink-400">Renews {sub.period_end.slice(0, 10)}</div>
          ) : null}
        </div>
        <ChangePlan current={s.org.plan} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(([id, price]) => (
          <Card key={id} className={`space-y-2 ${id === s.org.plan ? "border-brand-300" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold uppercase text-ink-700">{id}</span>
              {id === s.org.plan ? <Badge tone="new">current</Badge> : null}
            </div>
            <div className="text-2xl font-semibold text-ink-900">
              ${price}
              <span className="text-sm font-normal text-ink-400">/mo</span>
            </div>
            <p className="text-xs text-ink-500">
              {id === "free"
                ? "1 website, 10 AI generations/month"
                : id === "pro"
                  ? "3 websites, 200 AI generations/month"
                  : id === "growth"
                    ? "10 websites, 1000 AI generations/month"
                    : "Unlimited websites, 5000 AI generations/month"}
            </p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-900">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-ink-500">
            No invoices yet. This environment has no payment provider connected — plans change instantly with no
            charge until billing is wired up.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-700">
                  {i.period} · ${i.amount_usd.toFixed(2)} {i.currency}
                </span>
                <Badge tone={i.status === "paid" ? "completed" : "medium"}>{i.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-ink-400">
        No real charges occur in this build. Prices are read from configuration, never hard-coded in the UI.
      </p>
    </div>
  );
}
