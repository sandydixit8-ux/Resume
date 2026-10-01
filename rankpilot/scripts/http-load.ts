import { setTimeout as sleep } from "node:timers/promises";

/**
 * HTTP load test against the production build.
 *
 * The SQLite benchmark measures the database. This measures what a user
 * actually experiences: full request handling, through the real server.
 *
 * Boundaries on what this proves, stated up front so the numbers are not
 * over-read:
 *   - Closed-loop generator. Offered concurrency is fixed with no think time, so
 *     this is a saturation/throughput figure, not an "N users" claim.
 *   - Single-process, single-host, one machine. It says nothing about
 *     multi-node behaviour, and the in-memory rate limiter is per-process, so
 *     scaling out multiplies every limit by the node count.
 *   - p99 over a few hundred requests is indicative only.
 *
 * Usage:
 *   npm run bench:http
 *   npm run bench:http -- --requests 2000 --concurrency 32 --port 3290
 */

const args = process.argv.slice(2);
function flag(name: string, fallback: number): number {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
}

const port = String(flag("port", 3290));
const totalRequests = flag("requests", 800);
const concurrency = flag("concurrency", 16);
const base = `http://127.0.0.1:${port}`;

interface Sample {
  ms: number;
  status: number;
  /** Status this endpoint is supposed to return; anything else is a defect. */
  expect: number;
  path: string;
}

interface Endpoint {
  path: string;
  weight: number;
  expect: number;
}

/** Endpoints a real visitor hits first, weighted by how often. */
const ENDPOINTS: Endpoint[] = [
  { path: "/api/health/live", weight: 5, expect: 200 },
  { path: "/api/health/ready", weight: 2, expect: 200 },
  { path: "/", weight: 5, expect: 200 },
  { path: "/pricing", weight: 3, expect: 200 },
  // Anonymous: must be refused, and refusing must be cheap.
  { path: "/api/auth/me", weight: 4, expect: 401 },
];

const TOTAL_WEIGHT = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);

function pickEndpoint(): Endpoint {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const endpoint of ENDPOINTS) {
    roll -= endpoint.weight;
    if (roll <= 0) return endpoint;
  }
  return ENDPOINTS[0];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function timedFetch(endpoint: Endpoint): Promise<Sample> {
  const started = Date.now();
  try {
    // connection: close matches what a cold visitor experiences and stops a
    // pooled socket from hiding server-side queueing.
    const response = await fetch(`${base}${endpoint.path}`, {
      headers: { "user-agent": "rankpilot-load-test/1", connection: "close" },
      signal: AbortSignal.timeout(15_000),
    });
    await response.arrayBuffer();
    return { ms: Date.now() - started, status: response.status, expect: endpoint.expect, path: endpoint.path };
  } catch (error) {
    const status = error instanceof Error && error.name === "TimeoutError" ? 0 : -1;
    return { ms: Date.now() - started, status, expect: endpoint.expect, path: endpoint.path };
  }
}

async function waitForServer(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health/live`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await sleep(300);
  }
  return false;
}

async function main(): Promise<void> {
  if (!(await waitForServer())) {
    console.error(`No server on ${base}. Start it with \`npm run build && npm start\` first.`);
    process.exit(1);
  }

  console.log(
    `Load: ${totalRequests} requests, concurrency ${concurrency}\n` +
      `Endpoints: ${ENDPOINTS.map((e) => `${e.path} (${e.weight}/${TOTAL_WEIGHT} -> ${e.expect})`).join(", ")}\n`
  );

  const started = Date.now();
  const samples: Sample[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= totalRequests) return;
      samples.push(await timedFetch(pickEndpoint()));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const wallMs = Date.now() - started;
  const issued = samples.length;

  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  // A 401 from /api/auth/me is the endpoint working. Anything other than the
  // expected status is a defect, including timeouts (status 0) and connection
  // failures (status -1). Scoring on a raw ">= 400 is an error" range would
  // report correct auth refusals as failures.
  const unexpected = samples.filter((s) => s.status !== s.expect);

  const byStatus = new Map<number, number>();
  for (const s of samples) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);

  console.log("Latency (ms)");
  console.log(`  min    ${latencies[0] ?? 0}`);
  console.log(`  p50    ${percentile(latencies, 50)}`);
  console.log(`  p95    ${percentile(latencies, 95)}`);
  console.log(`  p99    ${percentile(latencies, 99)}`);
  console.log(`  max    ${latencies[latencies.length - 1] ?? 0}`);
  console.log(`\nThroughput: ${(issued / (wallMs / 1000)).toFixed(1)} req/s over ${wallMs}ms`);
  console.log(
    `Status codes: ${[...byStatus.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${s} x${n}`).join("  ")}`
  );
  console.log(`Unexpected statuses: ${unexpected.length}`);
  for (const bad of unexpected.slice(0, 5)) {
    console.log(`  ${bad.path} returned ${bad.status}, expected ${bad.expect}`);
  }

  // Verdict thresholds are deliberately loose: a regression tripwire, not a
  // capacity claim. A fast server returning 500s is not a pass, which is why
  // status correctness is checked at all.
  const p99 = percentile(latencies, 99);
  const errorRate = issued > 0 ? unexpected.length / issued : 1;
  const failed = errorRate > 0.01 || p99 > 2000;
  console.log(
    `\n${failed ? "FAIL" : "PASS"}: unexpected-status rate ${(errorRate * 100).toFixed(2)}%, ` +
      `p99 ${p99}ms (thresholds: <1% unexpected statuses, p99 <2000ms)`
  );
  process.exitCode = failed ? 1 : 0;
}

// Not a top-level await: tsx emits CJS here, which does not support it.
main().catch((error) => {
  console.error(`load test crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
