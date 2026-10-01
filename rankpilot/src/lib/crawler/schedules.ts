import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { registerHandler } from "@/lib/jobs/worker";
import { enqueue } from "@/lib/jobs/queue";

const INTERVAL_MS: Record<string, number> = {
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
};

/** Enqueue crawls for schedules that are due. Safe to call repeatedly. */
export function runSchedulesTick(): number {
  const due = all<{ id: string; tenant_id: string; website_id: string; frequency: string }>(
    "SELECT id, tenant_id, website_id, frequency FROM crawl_schedules WHERE enabled = 1 AND next_run_at <= ?",
    nowIso()
  );
  let enqueued = 0;
  for (const s of due) {
    const next = new Date(Date.now() + (INTERVAL_MS[s.frequency] ?? INTERVAL_MS.weekly)).toISOString();
    run("UPDATE crawl_schedules SET next_run_at = ?, last_run_at = ? WHERE id = ?", next, nowIso(), s.id);

    const site = row<{ id: string }>(
      "SELECT id FROM websites WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
      s.website_id,
      s.tenant_id
    );
    if (!site) {
      run("UPDATE crawl_schedules SET enabled = 0 WHERE id = ?", s.id);
      continue;
    }
    const active = row<{ id: string }>(
      "SELECT id FROM crawl_runs WHERE website_id = ? AND status IN ('queued','running')",
      s.website_id
    );
    if (active) continue;

    const runId = newId("run");
    run(
      `INSERT INTO crawl_runs (id, tenant_id, website_id, status, trigger, created_at)
       VALUES (?, ?, ?, 'queued', 'schedule', ?)`,
      runId,
      s.tenant_id,
      s.website_id,
      nowIso()
    );
    enqueue({ tenantId: s.tenant_id, type: "crawl.run", payload: { runId } });
    enqueued++;
  }
  return enqueued;
}

/** Register the recurring scheduler handler (no-op handler; the tick runs on start + interval). */
export function registerScheduleJobs(): void {
  registerHandler("schedules.tick", async () => {
    runSchedulesTick();
  });
}

/** Start the recurring tick. Called once at startup. */
export function scheduleTicks(): void {
  const intervalMs = Number(process.env.RANKPILOT_SCHEDULE_TICK_MS ?? 5 * 60_000);
  runSchedulesTick();
  const timer = setInterval(() => {
    if (process.env.RANKPILOT_WORKER === "off") return;
    runSchedulesTick();
  }, intervalMs);
  timer.unref?.();
}
