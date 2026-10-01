import { setTimeout as sleep } from "node:timers/promises";

/**
 * External health monitor.
 *
 * The single largest gap in this project was that nothing noticed a 3am
 * failure. Logs existed and an admin API existed, but nothing polled either.
 * This script is the polling side: it hits the probes, prints one line per
 * check, and exits non-zero so cron, systemd, Docker HEALTHCHECK, or an uptime
 * service can act on it.
 *
 * Deliberately dependency-free and independent of the app's own code, so a bug
 * in the app cannot also disable the thing that watches it. It re-implements
 * the checks against the wire format rather than importing the health module.
 *
 * Usage:
 *   npm run monitor:health                     # one pass, exit 0/1
 *   npm run monitor:health -- --watch          # poll forever
 *   npm run monitor:health -- --url https://... --interval 30
 */

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baseUrl = (flag("url", process.env.HEALTH_BASE_URL || "http://127.0.0.1:3000")).replace(/\/+$/, "");
const intervalSeconds = Number(flag("interval", process.env.HEALTH_INTERVAL_SECONDS || "30"));
const timeoutMs = Number(flag("timeout", process.env.HEALTH_TIMEOUT_MS || "10000"));

interface CheckResult {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
}

async function check(name: string, path: string, expectStatus: number): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "rankpilot-health-monitor/1",
        // No keep-alive. This process is a one-shot probe, and exiting while
        // undici still holds pooled sockets aborts the Node process on Windows
        // ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)") instead
        // of returning the exit code the caller is waiting for.
        connection: "close",
      },
    });
    const ms = Date.now() - started;
    const body = await response.text();
    let detail = body.slice(0, 200);
    try {
      const parsed = JSON.parse(body) as { ok?: boolean; error?: { code?: string } };
      // Report the status and error code, never the internals: this output
      // commonly ends up in a public status page or a chat notification.
      detail = parsed.ok === true ? "ok" : `error=${parsed.error?.code ?? "unknown"}`;
    } catch {
      // Non-JSON body from a proxy or error page is itself a finding.
      detail = `non-JSON body (${detail.length} bytes)`;
    }
    return { name, ok: response.status === expectStatus, status: response.status, ms, detail };
  } catch (error) {
    const ms = Date.now() - started;
    const reason = error instanceof Error && error.name === "AbortError" ? `timeout after ${timeoutMs}ms` : "unreachable";
    return { name, ok: false, status: 0, ms, detail: reason };
  } finally {
    clearTimeout(timer);
  }
}

async function runPass(): Promise<boolean> {
  const results = await Promise.all([
    // Liveness must not touch the database, so it is checked with a short
    // timeout: if /live needs the DB, a database outage becomes a restart loop.
    check("live", "/api/health/live", 200),
    check("ready", "/api/health/ready", 200),
  ]);

  for (const result of results) {
    const verdict = result.ok ? "PASS" : "FAIL";
    console.log(
      `${new Date().toISOString()} ${verdict} ${result.name.padEnd(5)} ` +
        `status=${result.status} ms=${result.ms} ${result.detail}`
    );
  }
  return results.every((r) => r.ok);
}

async function main(): Promise<void> {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 1) {
    console.error(`Invalid --interval ${intervalSeconds}`);
    process.exit(2);
  }

  if (!watch) {
    // Set exitCode and return rather than calling process.exit(), so the event
    // loop drains and the process exits cleanly with the code we set.
    process.exitCode = (await runPass()) ? 0 : 1;
    return;
  }

  let consecutiveFailures = 0;
  for (;;) {
    const ok = await runPass();
    consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
    if (!ok) {
      console.error(
        `${consecutiveFailures} consecutive failed pass(es). ` +
          (consecutiveFailures >= 3 ? "Sustained failure, not a blip." : "")
      );
    }
    await sleep(intervalSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(`health monitor crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
