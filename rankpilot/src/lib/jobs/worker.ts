import { claimNext, completeJob, failJob, reapStaleJobs, type JobRow, type ReapedJob } from "./queue";
import { describeError, log } from "@/lib/logger";

export type JobHandler = (payload: Record<string, unknown>, job: JobRow) => Promise<void>;

/**
 * Lets a job type release the domain state it owns when its worker is lost.
 * The queue only knows about the `jobs` table; a crawl also has to hand its
 * `crawl_runs` row back, and that table is not the queue's business.
 */
export type Reaper = (job: ReapedJob) => void;

const handlers = new Map<string, JobHandler>();
const reapers = new Map<string, Reaper>();

export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function registerReaper(type: string, reaper: Reaper): void {
  reapers.set(type, reaper);
}

let timer: NodeJS.Timeout | null = null;
let running = false;
const workerId = `w_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Hands jobs stranded by a dead worker back to the queue. A reaper that throws
 * must not stop the tick: the other jobs still need claiming.
 */
function releaseStaleLeases(): void {
  let reaped: ReapedJob[];
  try {
    reaped = reapStaleJobs();
  } catch (e) {
    log.error("could not reap stale jobs", describeError(e));
    return;
  }
  for (const job of reaped) {
    log.warn("reaped abandoned job", {
      jobId: job.id,
      type: job.type,
      tenantId: null,
      outcome: job.outcome,
    });
    try {
      reapers.get(job.type)?.(job);
    } catch (e) {
      // A broken reaper must not wedge the queue, but it must be visible.
      log.error("job reaper threw", { jobId: job.id, type: job.type, ...describeError(e) });
    }
  }
}

async function tick(): Promise<boolean> {
  if (running) return false;
  running = true;
  const startedAt = Date.now();
  try {
    releaseStaleLeases();
    const job = claimNext(workerId);
    if (!job) return false;
    const handler = handlers.get(job.type);
    if (!handler) {
      // A queued type with no registered handler is a deployment mistake, not
      // bad input: it will fail the same way on every retry until fixed.
      log.error("job has no registered handler", { jobId: job.id, type: job.type });
      failJob(job.id, `No handler registered for job type "${job.type}"`);
      return true;
    }
    try {
      const payload = JSON.parse(job.payload) as Record<string, unknown>;
      await handler(payload, job);
      completeJob(job.id);
      log.info("job completed", {
        jobId: job.id,
        type: job.type,
        tenantId: job.tenant_id,
        attempt: job.attempts,
        durationMs: Date.now() - startedAt,
      });
    } catch (e) {
      const err = describeError(e);
      const outcome = failJob(job.id, err.message);
      log.error("job failed", {
        jobId: job.id,
        type: job.type,
        tenantId: job.tenant_id,
        attempt: job.attempts,
        outcome,
        durationMs: Date.now() - startedAt,
        ...err,
      });
    }
    return true;
  } catch (e) {
    // Reached when the queue itself misbehaves (a database error while
    // claiming, say). Logged rather than swallowed: this is the one path that
    // can take down every job, and silence here hides an outage.
    log.error("worker tick failed", describeError(e));
    throw e;
  } finally {
    running = false;
  }
}

/** Start the in-process worker. Safe to call multiple times. */
export function startWorker(intervalMs = 400): void {
  if (timer || process.env.RANKPILOT_WORKER === "off") return;
  timer = setInterval(() => {
    // A throw here (a transient SQLite error, say) would otherwise become an
    // unhandled rejection, which terminates the process -- taking the whole
    // web server down with the worker. tick already logged it.
    void tick().catch(() => {
      /* the next tick retries; one bad job must not kill the server */
    });
  }, intervalMs);
  timer.unref?.();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Run queued jobs until the queue is empty (used by tests and CLI runs). */
export async function drainQueue(maxJobs = 50): Promise<number> {
  let processed = 0;
  for (let i = 0; i < maxJobs; i++) {
    const did = await tick();
    if (!did) break;
    processed++;
  }
  return processed;
}
