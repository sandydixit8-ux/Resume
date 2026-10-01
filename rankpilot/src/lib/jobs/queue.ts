import { all, newId, nowIso, row, run } from "@/lib/db/db";

export interface JobRow {
  id: string;
  tenant_id: string | null;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_at: string;
  started_at: string | null;
  finished_at: string | null;
  locked_by: string | null;
  error: string | null;
  created_at: string;
}

export interface EnqueueOptions {
  tenantId?: string | null;
  type: string;
  payload?: Record<string, unknown>;
  runAt?: string;
  maxAttempts?: number;
}

export function enqueue(opts: EnqueueOptions): string {
  const id = newId("job");
  run(
    `INSERT INTO jobs (id, tenant_id, type, payload, status, attempts, max_attempts, run_at, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    id,
    opts.tenantId ?? null,
    opts.type,
    JSON.stringify(opts.payload ?? {}),
    opts.maxAttempts ?? 3,
    opts.runAt ?? nowIso(),
    nowIso()
  );
  return id;
}

/** Atomically claim the next runnable job. Returns undefined when idle. */
export function claimNext(workerId: string): JobRow | undefined {
  const candidate = row<JobRow>(
    `SELECT * FROM jobs
     WHERE status = 'pending' AND run_at <= ?
     ORDER BY run_at ASC LIMIT 1`,
    nowIso()
  );
  if (!candidate) return undefined;
  const res = run(
    "UPDATE jobs SET status = 'running', started_at = ?, locked_by = ?, attempts = attempts + 1 WHERE id = ? AND status = 'pending'",
    nowIso(),
    workerId,
    candidate.id
  );
  if (res.changes !== 1) return undefined;
  return { ...candidate, status: "running", attempts: candidate.attempts + 1 };
}

export function completeJob(id: string): void {
  run(
    "UPDATE jobs SET status = 'done', finished_at = ?, error = NULL, locked_by = NULL WHERE id = ?",
    nowIso(),
    id
  );
}

const BACKOFF_MS = [5_000, 15_000, 60_000];

export function failJob(id: string, error: string): "retry" | "failed" {
  const job = row<{ attempts: number; max_attempts: number }>(
    "SELECT attempts, max_attempts FROM jobs WHERE id = ?",
    id
  );
  if (!job) return "failed";
  if (job.attempts < job.max_attempts) {
    const backoff = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)];
    run(
      "UPDATE jobs SET status = 'pending', error = ?, locked_by = NULL, run_at = ? WHERE id = ?",
      error.slice(0, 1000),
      new Date(Date.now() + backoff).toISOString(),
      id
    );
    return "retry";
  }
  run(
    "UPDATE jobs SET status = 'failed', finished_at = ?, error = ?, locked_by = NULL WHERE id = ?",
    nowIso(),
    error.slice(0, 1000),
    id
  );
  return "failed";
}

export interface ReapedJob {
  id: string;
  type: string;
  payload: string;
  outcome: "retry" | "failed";
  reason: string;
}

/**
 * How long a claimed job may stay `running` before it is presumed lost.
 *
 * Two hours is comfortably longer than the slowest legitimate crawl (agency
 * plans cap at 2000 pages), so a healthy long crawl is never reaped. It is
 * tunable for deployments with very large caps.
 */
const DEFAULT_LEASE_MS = 2 * 60 * 60_000;

export function leaseMs(): number {
  const raw = Number(process.env.RANKPILOT_JOB_LEASE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LEASE_MS;
}

/**
 * Requeues jobs left `running` by a worker that died mid-job.
 *
 * `claimNext` only ever selects `pending`, so without this a lost worker's job
 * is never picked up again: the work is silently dropped, with no retry, no
 * error surfaced to the user, and a `running` row that skews `queueDepth()`
 * forever. Re-running is safe because handlers are idempotent (crawls upsert
 * pages by `url_key`), and `failJob` bounds the retries via `max_attempts`.
 */
export function reapStaleJobs(lease = leaseMs()): ReapedJob[] {
  const cutoff = new Date(Date.now() - lease).toISOString();
  const stale = all<JobRow>(
    `SELECT * FROM jobs
     WHERE status = 'running' AND started_at IS NOT NULL AND started_at < ?`,
    cutoff
  );
  const reaped: ReapedJob[] = [];
  for (const job of stale) {
    const reason = `worker lease expired after ${Math.round(lease / 1000)}s`;
    reaped.push({
      id: job.id,
      type: job.type,
      payload: job.payload,
      outcome: failJob(job.id, reason),
      reason,
    });
  }
  return reaped;
}

export function getJob(id: string): JobRow | undefined {
  return row<JobRow>("SELECT * FROM jobs WHERE id = ?", id);
}

export function queueDepth(): number {
  const r = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM jobs WHERE status IN ('pending','running')"
  );
  return r?.n ?? 0;
}

export function pendingJobIds(): string[] {
  return all<{ id: string }>(
    "SELECT id FROM jobs WHERE status = 'pending' AND run_at <= ? ORDER BY run_at",
    nowIso()
  ).map((r) => r.id);
}
