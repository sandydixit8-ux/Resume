import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { newId, nowIso, row, run, tx } from "@/lib/db/db";
import { getLimits, isDowngrade } from "@/lib/plans";
import { selfServeAllowed } from "@/lib/billing/plan-access";
import { audit } from "@/lib/audit";

const patchSchema = z.object({ plan: z.enum(["free", "pro", "growth", "agency"]) });

/**
 * Plan changes are local. Real upgrades flow through the Stripe checkout +
 * webhook (see /api/billing/checkout and /api/billing/webhook): the customer is
 * redirected to Stripe, pays, and the webhook applies the new plan. This PATCH
 * endpoint is deliberately NOT that path — it changes a plan without any
 * payment, so it only serves callers explicitly allowlisted for self-serve
 * (see `selfServeAllowed` for why a role check is not enough). Downgrades are
 * always allowed and are blocked only while usage exceeds the target plan's
 * limits.
 */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "billing:write")) return err.forbidden();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const next = parsed.data.plan;
  const current = row<{ plan: string }>(
    "SELECT plan FROM organizations WHERE id = ?",
    s.org.id
  );
  if (!current) return err.notFound();

  // Ordering matters: refusing a plan you cannot afford to keep would strand the
  // account, so downgrades are evaluated first and never gated.
  const downgrading = isDowngrade(current.plan, next);

  if (!downgrading && !selfServeAllowed(s.user.email)) {
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "billing.plan_change_denied",
      entity: "organization",
      entityId: s.org.id,
      meta: { from: current.plan, to: next, reason: "not_allowlisted" },
    });
    return err.quota(
      'Self-serve plan changes are not available: use Stripe checkout to upgrade, and downgrades still work ' +
        `where usage allows it. "${next}" was not granted because this account is not allowlisted.`
    );
  }

  const limits = getLimits(next);
  const websites =
    row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM websites WHERE tenant_id = ? AND deleted_at IS NULL",
      s.org.id
    )?.n ?? 0;
  if (limits.websites !== -1 && websites > limits.websites) {
    return err.quota(
      `You have ${websites} websites; the ${next} plan allows ${limits.websites}. Remove websites before downgrading.`
    );
  }

  const now = nowIso();
  tx(() => {
    run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", next, now, s.org.id);
    const existing = row<{ id: string }>(
      "SELECT id FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
      s.org.id
    );
    if (existing) {
      run("UPDATE subscriptions SET plan = ?, updated_at = ? WHERE id = ?", next, now, existing.id);
    } else {
      run(
        "INSERT INTO subscriptions (id, tenant_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)",
        newId("sub"),
        s.org.id,
        next,
        now,
        now
      );
    }
  });

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "billing.plan_change",
    entity: "organization",
    entityId: s.org.id,
    meta: { from: current.plan, to: next },
  });

  return ok({ plan: next, previous: current.plan, charged: 0 });
}
