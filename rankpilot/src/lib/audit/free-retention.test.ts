import { beforeEach, describe, expect, it } from "vitest";
import { getDb, run, nowIso, newId, FREE_AUDIT_RETENTION_DAYS } from "@/lib/db/db";
import { expiredFreeAuditCount, purgeExpiredFreeAudits, retentionDeadline } from "./free-retention";

function insertAudit(expiresAt: string | null) {
  const id = newId("aud");
  run(
    "INSERT INTO free_audits (id, url, email, ip, score, snapshot, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    "https://example.com",
    "person@example.com",
    "1.2.3.4",
    50,
    "{}",
    nowIso(),
    expiresAt
  );
  return id;
}

function countAudits(): number {
  const r = getDb().prepare("SELECT COUNT(*) AS n FROM free_audits").get() as { n: number };
  return r.n;
}

describe("free audit retention", () => {
  beforeEach(() => {
    run("DELETE FROM free_audits");
  });

  it("sets a deadline in the future on insert", () => {
    const deadline = retentionDeadline(new Date("2026-01-01T00:00:00Z"));
    const parsed = new Date(deadline).getTime();
    const created = new Date("2026-01-01T00:00:00Z").getTime();
    const days = Math.round((parsed - created) / 86_400_000);
    expect(days).toBe(FREE_AUDIT_RETENTION_DAYS);
    expect(days).toBeGreaterThan(0);
  });

  it("deletes only expired rows", () => {
    const expired = insertAudit(new Date(Date.now() - 86_400_000).toISOString());
    const live = insertAudit(new Date(Date.now() + 86_400_000).toISOString());
    const result = purgeExpiredFreeAudits();
    expect(result.deleted).toBe(1);
    const remaining = getDb()
      .prepare("SELECT id FROM free_audits")
      .all()
      .map((r) => (r as { id: string }).id);
    expect(remaining).toEqual([live]);
    expect(remaining).not.toContain(expired);
  });

  it("keeps rows that have no deadline yet", () => {
    // A row written before the migration must not be deletable by accident,
    // and must not be deletable merely for lacking a deadline either.
    insertAudit(null);
    expect(purgeExpiredFreeAudits().deleted).toBe(0);
    expect(countAudits()).toBe(1);
  });

  it("respects the batch size so a large backlog does not lock the table", () => {
    for (let i = 0; i < 12; i++) insertAudit(new Date(Date.now() - 86_400_000).toISOString());
    expect(purgeExpiredFreeAudits(5).deleted).toBe(5);
    expect(countAudits()).toBe(7);
    // And draining it fully takes more than one batch.
    expect(purgeExpiredFreeAudits(5).deleted).toBe(5);
    expect(purgeExpiredFreeAudits(5).deleted).toBe(2);
    expect(countAudits()).toBe(0);
  });

  it("reports what is still expired so a backlog is visible", () => {
    insertAudit(new Date(Date.now() - 86_400_000).toISOString());
    insertAudit(new Date(Date.now() - 86_400_000).toISOString());
    expect(expiredFreeAuditCount()).toBe(2);
    purgeExpiredFreeAudits(1);
    expect(expiredFreeAuditCount()).toBe(1);
  });

  it("cannot reach paid or customer data", () => {
    // The purge statement names only free_audits, so no amount of retention
    // misconfiguration can delete a customer's reports or pages.
    const src = purgeExpiredFreeAudits.toString();
    expect(src).toContain("free_audits");
    expect(src).not.toContain("reports");
    expect(src).not.toContain("pages");
    expect(src).not.toContain("users");
  });

  it("actually removes the stored email and ip", () => {
    // The point of retention: personal data really leaves the database.
    insertAudit(new Date(Date.now() - 86_400_000).toISOString());
    purgeExpiredFreeAudits();
    const rows = getDb().prepare("SELECT email, ip FROM free_audits").all();
    expect(rows).toHaveLength(0);
  });
});
