import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * SQLite write-concurrency probe.
 *
 * Run with: npx tsx scripts/sqlite-concurrency.ts   (or via `npm run bench:sqlite`)
 *
 * The question this answers: how many concurrent writers can RankPilot take
 * before SQLITE_BUSY starts failing real requests? Guessing here is how you
 * discover the answer in production, so it gets measured.
 *
 * Results are printed, never asserted into the test suite -- a machine-speed
 * threshold would make CI flaky. See docs/11 for the recorded numbers and the
 * resulting recommendation.
 */

const LEVELS = [1, 5, 10, 25, 50, 100];
const WRITES_PER_WRITER = 20;

interface Result {
  writers: number;
  totalWrites: number;
  succeeded: number;
  failed: number;
  wallMs: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
  busyErrors: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function trial(writers: number, dir: string): Promise<Result> {
  const dbPath = join(dir, `bench-${writers}-${Date.now()}.db`);
  const latencies: number[] = [];
  let succeeded = 0;
  let failed = 0;
  let busyErrors = 0;

  const setup = new DatabaseSync(dbPath);
  // WAL lets readers run during a write, which is the realistic configuration
  // and the one that decides whether this scales beyond one box.
  setup.exec("PRAGMA journal_mode = WAL");
  setup.exec("PRAGMA busy_timeout = 5000");
  setup.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)");
  setup.close();

  const start = Date.now();
  const run = async (writer: number) => {
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA busy_timeout = 5000");
    const insert = db.prepare("INSERT INTO t (v) VALUES (?)");
    for (let i = 0; i < WRITES_PER_WRITER; i++) {
      const t0 = performance.now();
      try {
        insert.run(`w${writer}-${i}`);
        latencies.push(performance.now() - t0);
        succeeded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/BUSY|LOCK/i.test(msg)) busyErrors++;
        failed++;
      }
    }
    db.close();
  };

  await Promise.all(Array.from({ length: writers }, (_, i) => run(i)));
  const wallMs = Date.now() - start;

  const verify = new DatabaseSync(dbPath);
  const count = verify.prepare("SELECT COUNT(*) AS n FROM t").get() as { n: number };
  verify.close();
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });

  if (count.n !== succeeded) {
    throw new Error(`consistency failure: wrote ${succeeded} but found ${count.n} rows`);
  }

  latencies.sort((a, b) => a - b);
  return {
    writers,
    totalWrites: succeeded + failed,
    succeeded,
    failed,
    wallMs,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    maxMs: latencies[latencies.length - 1] ?? 0,
    busyErrors,
  };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "rankpilot-bench-"));
  console.log("SQLite write concurrency probe");
  console.log(`writes per writer: ${WRITES_PER_WRITER}, busy_timeout: 5000ms, journal: WAL\n`);
  console.log(
    ["writers", "writes", "ok", "failed", "wall(ms)", "p50", "p95", "p99", "max", "busy"].join("\t")
  );

  const results: Result[] = [];
  for (const writers of LEVELS) {
    const r = await trial(writers, dir);
    results.push(r);
    console.log(
      [
        r.writers,
        r.totalWrites,
        r.succeeded,
        r.failed,
        r.wallMs,
        r.p50.toFixed(2),
        r.p95.toFixed(2),
        r.p99.toFixed(2),
        r.maxMs.toFixed(2),
        r.busyErrors,
      ].join("\t")
    );
  }

  rmSync(dir, { recursive: true, force: true });

  console.log("\nInterpretation");
  const clean = results.filter((r) => r.failed === 0);
  const worst = results[results.length - 1];
  if (worst.failed === 0) {
    console.log(`No write failed up to ${worst.writers} concurrent writers.`);
    console.log(
      `Worst p99 at ${worst.writers} writers: ${worst.p99.toFixed(2)}ms (total ${worst.wallMs}ms for ${worst.totalWrites} writes).`
    );
  } else {
    const firstBad = results.find((r) => r.failed > 0);
    console.log(`First failure at ${firstBad?.writers} writers (${firstBad?.failed} failed).`);
  }
  console.log(
    `\nNote: this is a single-process probe on ${process.platform}. Multiple app nodes cannot share one SQLite file over a network filesystem safely; see docs/11.`
  );
  void clean;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
