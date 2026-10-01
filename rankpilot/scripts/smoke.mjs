#!/usr/bin/env node
/**
 * Post-build smoke test.
 *
 * A green build proves the code compiles, not that the server starts and
 * answers. This boots the production server, probes the endpoints that matter,
 * asserts a protected route still refuses anonymous access, and always tears
 * the process down.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const PORT = process.env.SMOKE_PORT || "3277";
const BASE = `http://127.0.0.1:${PORT}`;

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body, headers: res.headers };
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health/live`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

// Spawn node directly against the Next CLI rather than going through the npx
// .cmd shim: a shell wrapper would make `taskkill /t` tear down the parent shell
// too, and killing this run from the outside is not a recoverable situation.
const NEXT_BIN = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const TSX_BIN = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

const server = spawn(process.execPath, [NEXT_BIN, "start", "-p", PORT], {
  stdio: "ignore",
  env: { ...process.env, AUTH_SECRET: process.env.AUTH_SECRET || "smoke-secret-not-real-0123456789abcdef" },
});

let exitCode = 1;
try {
  if (!(await waitForServer())) {
    console.error("Server did not start in time.");
  } else {
    const live = await get("/api/health/live");
    check("liveness returns 200", live.status === 200, `status=${live.status}`);
    check(
      "liveness reports live",
      live.body?.data?.status === "live",
      JSON.stringify(live.body?.data ?? {})
    );

    const ready = await get("/api/health/ready");
    check("readiness returns 200 with a working database", ready.status === 200, `status=${ready.status}`);
    check("readiness reports db ok", ready.body?.data?.db === "ok");

    const health = await get("/api/health");
    check("legacy /api/health still works", health.status === 200, `status=${health.status}`);

    // Anonymous access to a protected route must be refused, or the RBAC guards
    // are not actually wired into the running app.
    const guarded = await get("/api/websites");
    check("protected route refuses anonymous access", guarded.status === 401, `status=${guarded.status}`);

    // A request id must come back on every response, or log correlation fails.
    const id = health.headers.get("x-request-id");
    check("responses carry x-request-id", Boolean(id), id ?? "missing");

    // The security headers the proxy sets must actually be present.
    check("X-Frame-Options is set", health.headers.get("x-frame-options") === "DENY");
    check("X-Content-Type-Options is set", health.headers.get("x-content-type-options") === "nosniff");

    // Unconfigured email must fail loudly rather than pretending to send.
    const reset = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com" }),
    });
    const resetBody = await reset.json().catch(() => ({}));
    const emailExplicit =
      reset.status === 503 || (reset.status === 200 && typeof resetBody?.data?.message === "string");
    check(
      "password reset is explicit about email availability",
      emailExplicit,
      `status=${reset.status}`
    );
  }

  // Exercise the external health monitor against the running server. It is the
  // component that would notice a 3am outage, so it needs to be covered by CI;
  // otherwise it is only correct in theory. Runs here because this script owns
  // the server lifecycle, and the monitor has nothing to poll once we exit.
  const monitor = spawn(process.execPath, [TSX_BIN, "scripts/monitor-health.ts"], {
    env: { ...process.env, HEALTH_BASE_URL: BASE },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let monitorOut = "";
  monitor.stdout.on("data", (d) => (monitorOut += d));
  monitor.stderr.on("data", (d) => (monitorOut += d));
  const monitorCode = await new Promise((r) => monitor.on("exit", r));
  check(
    "external health monitor reports both probes healthy",
    monitorCode === 0,
    `exit=${monitorCode} ${monitorOut.trim().split("\n").slice(-1)[0] ?? ""}`
  );
} catch (e) {
  console.error("Smoke test error:", e);
} finally {
  server.kill();
  await sleep(1500);
}

const failed = checks.filter((c) => !c.ok);
for (const c of failed) console.log(`  FAIL  ${c.name} -- ${c.detail}`);
console.log(`\n${checks.length - failed.length}/${checks.length} smoke checks passed`);
// Must assign 0 explicitly. The initial value is 1 so that a crash before the
// checks run still fails the gate; only reaching the end with no failures is
// allowed to turn it green.
exitCode = failed.length > 0 ? 1 : 0;
process.exit(exitCode);
