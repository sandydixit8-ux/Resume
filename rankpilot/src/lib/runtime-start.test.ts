import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Boot behaviour, verified by actually booting.
 *
 * The regression: a missing `AUTH_SECRET` used to let `next start` complete
 * normally. The server bound the port, reported "Ready", and answered every
 * request with 500. systemd, Docker and Kubernetes all treat an open port as
 * healthy, so a completely broken deploy looked like a healthy one and sat
 * there failing until a human noticed.
 *
 * Asserting this from the test process is not possible, because the behaviour
 * under test is `process.exit(1)` — it would take the runner with it. So each
 * case spawns a child and inspects how it died.
 */
const HARNESS = resolve("src/lib/runtime-start.harness.ts");
const TSX = resolve("node_modules/tsx/dist/cli.mjs");
const source = readFileSync(resolve("src/lib/runtime-start.ts"), "utf8");

function boot(overrides: Record<string, string | undefined>, timeoutMs = 30_000) {
  // Inside the run's scratch directory so the teardown removes it. A bare
  // mkdtempSync here leaked a directory per boot, 50+ of them per suite run.
  const dir = join(process.env.RANKPILOT_TEST_DIR ?? tmpdir(), `boot-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return new Promise<{ code: number | null; stderr: string; stdout: string }>((res) => {
    const child = spawn(process.execPath, [TSX, HARNESS], {
      env: {
        PATH: process.env.PATH,
        // `assertProductionConfig` is a no-op outside production, so the boot
        // path under test only engages with this set. That is correct behaviour
        // — a developer's laptop should not be forced to hold a real secret.
        NODE_ENV: "production",
        // A scratch database so a booting child never opens the real one.
        RANKPILOT_DB_PATH: join(dir, "boot.db"),
        RANKPILOT_SCHEDULES: "off",
        ...overrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      res({ code, stderr, stdout });
    });
  });
}

describe("runtime startup", () => {
  it("exits non-zero and says why when AUTH_SECRET is missing", async () => {
    const result = await boot({ AUTH_SECRET: undefined });
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/FATAL/);
    expect(result.stderr).toMatch(/failed to start/);
    // The operator needs the actual cause, not just a failure code.
    expect(result.stderr).toMatch(/AUTH_SECRET/);
  });

  it("exits non-zero when AUTH_SECRET is a known placeholder", async () => {
    const result = await boot({ AUTH_SECRET: "change-me-to-a-long-random-string" });
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/FATAL/);
  });

  it("does not exit 1 for a valid secret, so the guard is not simply always-fail", async () => {
    // A valid config starts the worker and keeps running, so the child is killed
    // by the timeout. Exit code null is the signal that boot did not bail.
    const result = await boot(
      { AUTH_SECRET: "a-valid-test-secret-that-is-long-enough" },
      8_000
    );
    expect(result.code).not.toBe(1);
    expect(result.stderr).not.toMatch(/FATAL/);
  });

  it("keeps process.exit out of the Edge bundle path", () => {
    // instrumentation.ts must not import this module at the top level, or
    // `process` gets pulled into the Edge build.
    const instrumentation = readFileSync(resolve("src/instrumentation.ts"), "utf8");
    expect(instrumentation).toMatch(/NEXT_RUNTIME !== "nodejs"/);
    expect(instrumentation).toMatch(/await import\("\.\/lib\/runtime-start"\)/);
  });

  it("exits rather than letting a rejection become an unhandled one", () => {
    expect(source).toMatch(/process\.exit\(1\)/);
  });
});
