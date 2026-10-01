import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, fail, ok, parseBody, readJson } from "@/lib/http";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { purgeTenant, tenantsPendingErasure } from "@/lib/privacy/erasure";

/**
 * Owner-only data erasure for a tenant.
 *
 * This exists because `purgeTenant` was previously a library with no way to
 * reach it: an erasure request could be received and then sat in a mailbox
 * until someone ran a script by hand. That is not an erasure process.
 *
 * Safety properties, because this deletes a customer's entire account:
 *   - Owner only. A tenant admin cannot erase their own org, so a compromised
 *     or malicious admin session cannot destroy the data of the business that
 *     owns it.
 *   - Dry run unless `confirm` is explicitly true. The response of a dry run
 *     lists exactly what would be deleted, so the destructive call is always a
 *     second, informed step.
 *   - `confirmTenantId` must repeat the tenant id, so a stale tab or a
 *     mis-copied request cannot delete the wrong account.
 *   - Rate limited, because a loop against this endpoint is a denial of
 *     service on the queue.
 *   - Audited before and after, with counts, so there is a record of who
 *     destroyed what and whether it actually worked.
 */
const Body = z.object({
  tenantId: z.string().min(1).max(64),
  /** Literal true, plus the id again, to make destruction deliberate. */
  confirm: z.literal(true).optional(),
  confirmTenantId: z.string().min(1).max(64).optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "billing:write")) return err.forbidden();

  const rl = rateLimit(`erasure:${s.user.id}`, 5, 60_000);
  if (!rl.allowed) return err.rateLimited();

  const raw = await readJson(req);
  const parsed = parseBody(raw, Body);
  if (!parsed.success) return err.validation(parsed.error.flatten());

  const { tenantId, confirm, confirmTenantId } = parsed.data;

  if (confirm !== true) {
    const preview = purgeTenant(tenantId, { dryRun: true });
    return ok({
      dryRun: true,
      tenantId,
      wouldDelete: preview.deleted,
      wouldAnonymize: preview.anonymized,
      message: "Nothing was deleted. Repeat with confirm: true and confirmTenantId to proceed.",
    });
  }

  if (confirmTenantId !== tenantId) {
    audit({
      tenantId,
      userId: s.user.id,
      action: "erasure.rejected_mismatch",
      entity: "organization",
      entityId: tenantId,
      meta: { suppliedConfirm: confirmTenantId },
    });
    return fail("confirmTenantId must match tenantId", 400, "confirm_mismatch");
  }

  audit({
    tenantId,
    userId: s.user.id,
    action: "erasure.requested",
    entity: "organization",
    entityId: tenantId,
  });

  const result = purgeTenant(tenantId, { dryRun: false });

  // `purgeTenant` reports rather than throws when foreign keys are off. Proceeding
  // on that result would delete the organization row and leave every child row
  // behind while reporting success, so refuse instead.
  if (result.warning) {
    audit({
      tenantId,
      userId: s.user.id,
      action: "erasure.failed_cascades_disabled",
      entity: "organization",
      entityId: tenantId,
      meta: { warning: result.warning },
    });
    return fail(
      "Erasure refused: foreign key enforcement is off, so the purge would leave child rows behind.",
      500,
      "cascades_disabled"
    );
  }

  const orgCount = result.deleted.organizations ?? 0;
  if (orgCount === 0) {
    return fail("No such tenant, or it was already erased", 404, "not_found");
  }

  audit({
    tenantId,
    userId: s.user.id,
    action: "erasure.completed",
    entity: "organization",
    entityId: tenantId,
    meta: { deleted: result.deleted, anonymized: result.anonymized },
  });

  return ok({
    dryRun: false,
    tenantId,
    deleted: result.deleted,
    anonymized: result.anonymized,
    // Audit rows are intentionally retained and anonymized rather than deleted,
    // so the record of this erasure survives it.
    auditRetained: true,
    stillPending: tenantsPendingErasure().length,
  });
}
