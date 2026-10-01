import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Inside the run's scratch directory so the suite teardown removes it. A bare
// mkdtempSync here leaked a directory on every test run.
const dir = join(process.env.RANKPILOT_TEST_DIR ?? tmpdir(), `lease-${randomUUID()}`);
mkdirSync(dir, { recursive: true });
process.env.RANKPILOT_DB_PATH = join(dir, "q.db");

import { describe, expect, it } from "vitest";
import { nowIso, run } from "@/lib/db/db";
import { claimNext, enqueue, getJob, leaseMs, queueDepth, reapStaleJobs } from "./queue";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

/** Simulates a worker that claimed a job and then died. */
function strand(jobId: string, startedAt: string, attempts = 1): void {
  run(
    "UPDATE jobs SET status = 'running', started_at = ?, locked_by = 'w_dead', attempts = ? WHERE id = ?",
    startedAt,
    attempts,
    jobId
  );
}

describe("stale job leases", () => {
  it("defaults to a lease longer than the slowest legitimate crawl", () => {
    // agency plans crawl up to 2000 pages; a lease shorter than the real
    // worst case would reap healthy work and crawl the site twice.
    expect(leaseMs()).toBe(2 * 60 * 60_000);
  });

  it("requeues a job whose worker died, so the work is not silently dropped", () => {
    const id = enqueue({ type: "crawl.run", payload: { runId: "run_1" } });
    strand(id, hoursAgo(3));

    const reaped = reapStaleJobs(2 * 60 * 60_000);
    expect(reaped.map((r) => r.id)).toContain(id);

    const job = getJob(id);
    expect(job?.status).toBe("pending");
    expect(job?.locked_by).toBeNull();
    expect(job?.error).toMatch(/lease expired/);
    // Deferred, not run inline: a requeue respects the backoff schedule.
    expect(job!.run_at > nowIso()).toBe(true);
  });

  it("leaves a healthy in-flight job alone", () => {
    const id = enqueue({ type: "crawl.run" });
    strand(id, nowIso());
    expect(reapStaleJobs(2 * 60 * 60_000).map((r) => r.id)).not.toContain(id);
    expect(getJob(id)?.status).toBe("running");
  });

  it("ignores jobs that were never claimed", () => {
    const id = enqueue({ type: "crawl.run" });
    expect(reapStaleJobs(1).map((r) => r.id)).not.toContain(id);
    expect(getJob(id)?.status).toBe("pending");
  });

  it("stops retrying once attempts are exhausted instead of looping forever", () => {
    const id = enqueue({ type: "crawl.run", maxAttempts: 2 });
    strand(id, hoursAgo(3), 2);

    const reaped = reapStaleJobs(2 * 60 * 60_000);
    expect(reaped.find((r) => r.id === id)?.outcome).toBe("failed");
    expect(getJob(id)?.status).toBe("failed");
    expect(getJob(id)?.finished_at).not.toBeNull();
  });

  it("makes a stranded job claimable again", () => {
    const id = enqueue({ type: "crawl.run" });
    // Other cases in this file leave jobs behind; isolate the queue so the
    // assertion is about this job and not about whoever is oldest.
    run("UPDATE jobs SET status = 'done' WHERE id != ?", id);
    strand(id, hoursAgo(3));
    reapStaleJobs(2 * 60 * 60_000);

    // Backoff means it is not due yet; that is the point of the delay.
    expect(claimNext("w_live")).toBeUndefined();
    run("UPDATE jobs SET run_at = ? WHERE id = ?", nowIso(), id);
    const claimed = claimNext("w_live");
    expect(claimed?.id).toBe(id);
    expect(claimed?.status).toBe("running");
  });

  it("clears the queue depth that a lost worker would have skewed forever", () => {
    const before = queueDepth();
    const id = enqueue({ type: "crawl.run" });
    strand(id, hoursAgo(3));
    expect(queueDepth()).toBe(before + 1);
    reapStaleJobs(2 * 60 * 60_000);
    expect(queueDepth()).toBe(before + 1); // requeued, still legitimately queued
    run("UPDATE jobs SET status = 'failed' WHERE id = ?", id);
    expect(queueDepth()).toBe(before);
  });

  it("reports the outcome so the domain can release its own state", () => {
    const id = enqueue({ type: "crawl.run", payload: { runId: "run_9" } });
    strand(id, hoursAgo(3));
    const job = reapStaleJobs(2 * 60 * 60_000).find((r) => r.id === id);
    expect(job?.type).toBe("crawl.run");
    expect(job?.payload).toContain("run_9");
    expect(job?.outcome).toBe("retry");
    expect(job?.reason).toMatch(/lease expired/);
  });
});
