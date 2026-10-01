import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Structural guards for the erasure endpoint.
 *
 * This route deletes a customer's entire account, and most of its value is in
 * what it refuses to do. These assertions are the durable record of that. They
 * read the source rather than driving the route, because the alternative is
 * mocking `getSession` to assert on an irreversible operation, which is a poor
 * trade for a test that mostly needs to prove a guard is still present.
 */
const source = readFileSync(
  resolve("src/app/api/admin/erasure/route.ts"),
  "utf8"
);

describe("POST /api/admin/erasure", () => {
  it("requires authentication", () => {
    expect(source).toMatch(/getSession\(\)/);
    expect(source).toMatch(/if \(!s\) return err\.auth\(\)/);
  });

  it("is owner-only, so a tenant admin cannot erase their own org", () => {
    // `admin:read` is deliberately not enough: erasing an account is a
    // business-level act, not an administrative one.
    expect(source).toMatch(/can\(s\.role, "billing:write"\)/);
    expect(source).toMatch(/if \(!can\(s\.role, "billing:write"\)\) return err\.forbidden\(\)/);
  });

  it("is a dry run unless confirm is literally true", () => {
    expect(source).toMatch(/z\.literal\(true\)\.optional\(\)/);
    expect(source).toMatch(/if \(confirm !== true\)/);
    expect(source).toMatch(/dryRun: true/);
    // The destructive call must be explicit, not the default.
    expect(source).toMatch(/purgeTenant\(tenantId, \{ dryRun: false \}\)/);
  });

  it("requires the tenant id to be repeated, so a stale request cannot delete the wrong account", () => {
    expect(source).toMatch(/confirmTenantId/);
    expect(source).toMatch(/if \(confirmTenantId !== tenantId\)/);
  });

  it("refuses to report success when cascades could not fire", () => {
    // A purge with foreign keys off deletes the org row and orphans every
    // child. Reporting that as success is worse than failing.
    expect(source).toMatch(/if \(result\.warning\)/);
    expect(source).toMatch(/cascades_disabled/);
  });

  it("does not claim success for a tenant it did not delete", () => {
    expect(source).toMatch(/orgCount === 0/);
    expect(source).toMatch(/not_found/);
  });

  it("rate limits, because a loop here is a denial of service", () => {
    expect(source).toMatch(/rateLimit\(/);
    expect(source).toMatch(/if \(!rl\.allowed\) return err\.rateLimited\(\)/);
  });

  it("audits the request, the rejection and the outcome", () => {
    expect(source).toMatch(/erasure\.requested/);
    expect(source).toMatch(/erasure\.rejected_mismatch/);
    expect(source).toMatch(/erasure\.completed/);
    expect(source).toMatch(/erasure\.failed_cascades_disabled/);
  });

  it("retains audit rows rather than deleting the evidence", () => {
    expect(source).toMatch(/auditRetained: true/);
  });
});
