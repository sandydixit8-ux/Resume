import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const worker = readFileSync(join(process.cwd(), "src", "lib", "jobs", "worker.ts"), "utf8");
const queue = readFileSync(join(process.cwd(), "src", "lib", "jobs", "queue.ts"), "utf8");

describe("worker resilience", () => {
  it("never lets a failing tick become an unhandled rejection", () => {
    // Node's default is to terminate the process on an unhandled rejection, so
    // a bare `void tick()` means one transient SQLite error kills the whole web
    // server rather than failing a single job.
    const interval = worker.slice(worker.indexOf("setInterval("), worker.indexOf("}, intervalMs)"));
    expect(interval).toMatch(/void tick\(\)\s*\.catch\(/);
    expect(interval).not.toMatch(/void tick\(\);/);
  });

  it("keeps a throwing reaper from wedging the queue", () => {
    // A reaper bug must not stop the other jobs being claimed.
    const release = worker.slice(
      worker.indexOf("function releaseStaleLeases"),
      worker.indexOf("async function tick")
    );
    expect(release).toMatch(/catch/);
    const dispatch = release.slice(release.indexOf("for (const job of reaped)"));
    expect(dispatch).toMatch(/catch/);
  });

  it("releases the lease before claiming, so stranded work is picked up", () => {
    const tick = worker.slice(worker.indexOf("async function tick"));
    expect(tick.indexOf("releaseStaleLeases()")).toBeLessThan(tick.indexOf("claimNext("));
  });

  it("bounds requeues by max_attempts rather than retrying forever", () => {
    // Reusing failJob is what inherits the attempt accounting.
    expect(queue).toMatch(/outcome: failJob\(/);
  });

  it("ignores a claim that lost the race, so two workers cannot share a job", () => {
    expect(queue).toMatch(/res\.changes !== 1/);
  });
});
