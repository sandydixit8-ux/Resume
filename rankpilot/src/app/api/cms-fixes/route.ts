import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";
import {
  wordpressConfig,
  parseFixPayload,
  backupPost,
  applyPost,
  verifyPost,
  restorePost,
  type PostSnapshot,
  type FixPayload,
} from "@/lib/cms/wordpress";

/**
 * CMS auto-fix flow: propose → backup → apply → verify → restore/discard.
 *
 * A fix only moves past "proposed" when the WordPress REST API actually answered:
 * the backup is the real pre-change content we read back, the apply is a real
 * write, and verify re-reads the post and reports drift instead of assuming
 * success. Without a configured WordPress application password every fix stops
 * at "blocked" and the site is never touched.
 */
const proposeSchema = z.object({
  websiteId: z.string().min(1),
  issueId: z.string().optional(),
  provider: z.enum(["wordpress", "shopify", "webflow", "wix", "manual"]).default("manual"),
  payload: z.record(z.string(), z.unknown()),
});

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["apply", "verify", "restore", "discard"]),
});

/** The provider a tenant has actually connected for CMS writes. */
function connectedCms(tenantId: string): string | null {
  return (
    row<{ provider: string }>(
      "SELECT provider FROM integrations WHERE tenant_id = ? AND status = 'connected' AND provider IN ('wp','webflow')",
      tenantId
    )?.provider ?? null
  );
}

function loadFix(tenantId: string, id: string) {
  return row<{
    id: string;
    website_id: string;
    provider: string;
    payload: string;
    backup_ref: string | null;
    backup_content: string | null;
    status: string;
    error: string | null;
  }>("SELECT * FROM cms_fixes WHERE id = ? AND tenant_id = ?", id, tenantId);
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();
  const items = all(
    `SELECT id, issue_id, provider, payload, backup_ref, (backup_content IS NOT NULL) AS has_backup,
            status, error, created_at, applied_at, verified_at
     FROM cms_fixes WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
    websiteId,
    s.org.id
  );
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const parsed = proposeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;
  if (!getWebsite(s.org.id, d.websiteId)) return err.notFound();

  const connected = connectedCms(s.org.id);
  const cfg = wordpressConfig();

  // A WordPress fix with a usable payload is a real candidate for backup. Take
  // the backup now, while the post is untouched, so apply is a two-step flow
  // that can always be undone.
  let backup: PostSnapshot | null = null;
  let blockedReason: string | null = null;
  if (!connected) {
    blockedReason = "No CMS integration connected — fix staged but not applied.";
  } else if ("problem" in cfg) {
    blockedReason = cfg.problem;
  } else if (d.provider === "wordpress") {
    const parsedPayload = parseFixPayload(d.payload);
    if ("problem" in parsedPayload) {
      blockedReason = parsedPayload.problem;
    } else {
      try {
        backup = await backupPost(cfg.config, parsedPayload.payload.postId);
      } catch (e) {
        blockedReason = e instanceof Error ? e.message : "WordPress backup failed.";
      }
    }
  } else {
    // webflow/shopify/wix have no write client in this build; say so plainly.
    blockedReason = `${d.provider} writes are not implemented — the fix is staged only.`;
  }

  const id = newId("fix");
  const now = nowIso();
  const status = blockedReason ? "blocked" : "proposed";
  run(
    `INSERT INTO cms_fixes (id, tenant_id, website_id, issue_id, provider, payload, backup_ref, backup_content, status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    s.org.id,
    d.websiteId,
    d.issueId ?? null,
    d.provider,
    JSON.stringify(d.payload),
    backup ? `wp_post_${backup.id}_${id}` : null,
    backup ? JSON.stringify(backup) : null,
    status,
    blockedReason,
    now
  );

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "cms_fix.propose",
    entity: "cms_fix",
    entityId: id,
    meta: {
      provider: d.provider,
      issueId: d.issueId ?? null,
      status,
      hasBackup: backup !== null,
    },
  });

  return ok({
    id,
    status,
    backupRef: backup ? `wp_post_${backup.id}_${id}` : null,
    note: blockedReason
      ? `Staged only — ${blockedReason}`
      : "Backup captured. Applying requires an explicit second call.",
  });
}

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const fix = loadFix(s.org.id, parsed.data.id);
  if (!fix) return err.notFound();
  const cfg = wordpressConfig();
  if ("problem" in cfg) return err.quota(cfg.problem);

  const now = nowIso();

  if (parsed.data.action === "apply") {
    if (fix.status === "blocked") return err.quota(fix.error ?? "Connect a CMS integration before applying fixes.");
    if (fix.status !== "proposed") return err.conflict(`Cannot apply a fix in status "${fix.status}".`);
    if (!fix.backup_content) return err.conflict("No backup was captured for this fix — re-propose it before applying.");
    const payloadParsed = parseFixPayload(JSON.parse(fix.payload));
    if ("problem" in payloadParsed) return err.validation(payloadParsed.problem);
    const payload: FixPayload = payloadParsed.payload;
    try {
      await applyPost(cfg.config, payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : "WordPress apply failed.";
      run("UPDATE cms_fixes SET status = 'failed', error = ? WHERE id = ?", message, fix.id);
      audit({
        tenantId: s.org.id,
        userId: s.user.id,
        action: "cms_fix.apply_failed",
        entity: "cms_fix",
        entityId: fix.id,
        meta: { error: message },
      });
      return err.upstream(message);
    }
    run("UPDATE cms_fixes SET status = 'applied', error = NULL, applied_at = ? WHERE id = ?", now, fix.id);
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "cms_fix.applied",
      entity: "cms_fix",
      entityId: fix.id,
      meta: { postId: payload.postId, backupRef: fix.backup_ref },
    });
    return ok({ id: fix.id, status: "applied", backupRef: fix.backup_ref });
  }

  if (parsed.data.action === "verify") {
    if (fix.status !== "applied") return err.conflict("Only applied fixes can be verified.");
    const payloadParsed = parseFixPayload(JSON.parse(fix.payload));
    if ("problem" in payloadParsed) return err.validation(payloadParsed.problem);
    const verdict = await verifyPost(cfg.config, payloadParsed.payload);
    if (!verdict.verified) {
      run("UPDATE cms_fixes SET error = ? WHERE id = ?", `verify_drift:${verdict.reason}`, fix.id);
      audit({
        tenantId: s.org.id,
        userId: s.user.id,
        action: "cms_fix.verify_drift",
        entity: "cms_fix",
        entityId: fix.id,
        meta: { reason: verdict.reason },
      });
      return err.conflict(`The live post does not match the fix (${verdict.reason}). Use restore to roll back.`);
    }
    run("UPDATE cms_fixes SET verified_at = ?, status = 'verified', error = NULL WHERE id = ?", now, fix.id);
    audit({ tenantId: s.org.id, userId: s.user.id, action: "cms_fix.verified", entity: "cms_fix", entityId: fix.id });
    return ok({ id: fix.id, status: "verified" });
  }

  if (parsed.data.action === "restore") {
    if (fix.status === "discarded") return err.conflict("This fix was discarded before it was ever applied.");
    if (!fix.backup_content) return err.conflict("No backup was captured for this fix — nothing to restore.");
    const backup = JSON.parse(fix.backup_content) as PostSnapshot;
    try {
      await restorePost(cfg.config, backup);
    } catch (e) {
      return err.upstream(e instanceof Error ? e.message : "WordPress restore failed.");
    }
    run("UPDATE cms_fixes SET status = 'restored', error = NULL, verified_at = ? WHERE id = ?", now, fix.id);
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "cms_fix.restored",
      entity: "cms_fix",
      entityId: fix.id,
      meta: { postId: backup.id },
    });
    return ok({ id: fix.id, status: "restored" });
  }

  // discard: only ever valid while nothing has been written to the site.
  if (fix.status === "applied" || fix.status === "verified") {
    return err.conflict("This fix is live on the site — restore it before discarding.");
  }
  run("UPDATE cms_fixes SET status = 'discarded' WHERE id = ?", fix.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "cms_fix.discarded", entity: "cms_fix", entityId: fix.id });
  return ok({ id: fix.id, status: "discarded" });
}
