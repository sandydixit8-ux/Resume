import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Structural guards for the CMS auto-fix route.
 *
 * This route is the only place in the product that writes to a customer's live
 * site, so most of its value is in the order of its refusals: no backup, no
 * write; no configured credential, no write; a drift on verify, a rollback
 * rather than a green tick. The WordPress client itself is exercised for real in
 * `src/lib/cms/wordpress.test.ts`; these assertions pin the guards that only
 * exist in this file.
 */
const source = readFileSync(resolve("src/app/api/cms-fixes/route.ts"), "utf8");

describe("POST /api/cms-fixes", () => {
  it("requires a session and a website write permission", () => {
    expect(source).toMatch(/getSession\(\)/);
    expect(source).toMatch(/if \(!s\) return err\.auth\(\)/);
    expect(source).toMatch(/can\(s\.role, "website:write"\)/);
    expect(source).toMatch(/if \(!can\(s\.role, "website:write"\)\) return err\.forbidden\(\)/);
  });

  it("captures a real backup before a fix can ever be applied", () => {
    expect(source).toMatch(/await backupPost\(/);
    // The pre-change content is persisted, so restore is possible rather than
    // merely referenced.
    expect(source).toMatch(/backup_content/);
  });

  it("stops at blocked when the CMS is unconnected or unconfigured", () => {
    expect(source).toMatch(/if \(!connected\)/);
    expect(source).toMatch(/if \("problem" in cfg\)/);
    expect(source).toMatch(/const status = blockedReason \? "blocked" : "proposed"/);
  });

  it("does not name other providers' writes as implemented", () => {
    expect(source).toMatch(/writes are not implemented/);
  });

  it("audits the proposal, including whether a backup was taken", () => {
    expect(source).toMatch(/action: "cms_fix\.propose"/);
    expect(source).toMatch(/hasBackup: backup !== null/);
  });
});

describe("PATCH /api/cms-fixes", () => {
  it("refuses to apply without a captured backup", () => {
    expect(source).toMatch(/if \(!fix\.backup_content\) return err\.conflict\(/);
  });

  it("applies only from the proposed state", () => {
    expect(source).toMatch(/if \(fix\.status !== "proposed"\) return err\.conflict\(/);
  });

  it("records a failed apply as failed, not as applied", () => {
    expect(source).toMatch(/SET status = 'failed', error = \? WHERE id = \?/);
    expect(source).toMatch(/action: "cms_fix\.apply_failed"/);
  });

  it("verifies by re-reading the live post and reporting drift", () => {
    expect(source).toMatch(/await verifyPost\(/);
    expect(source).toMatch(/if \(!verdict\.verified\)/);
    expect(source).toMatch(/action: "cms_fix\.verify_drift"/);
    // Drift must not be papered over with a verified timestamp.
    expect(source).not.toMatch(/verify_drift[\s\S]{0,200}SET verified_at/);
  });

  it("can restore the captured backup, and only from a real one", () => {
    expect(source).toMatch(/await restorePost\(/);
    expect(source).toMatch(/No backup was captured for this fix — nothing to restore/);
  });

  it("will not discard a fix that is live on the site", () => {
    expect(source).toMatch(/if \(fix\.status === "applied" \|\| fix\.status === "verified"\)/);
    expect(source).toMatch(/restore it before discarding/);
  });
});