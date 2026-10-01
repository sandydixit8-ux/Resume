import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  durabilityProblem,
  formatResult,
  mountForPath,
  parseMounts,
  runPostDeployChecks,
  type MountInfo,
} from "./post-deploy-check";

/**
 * These checks exist to catch the failure where a deploy looks completely healthy
 * and then loses the database. Most of the tests are therefore about the bad
 * case: a tmpfs database, a service that boots but cannot reach its data, or a
 * backup job that silently never ran.
 */

let root: string;
let dbDir: string;
let backupDir: string;
let dbPath: string;

const OVERLAY_MOUNTS: MountInfo[] = [
  { mountPoint: "/", fsType: "ext4" },
  { mountPoint: "/var/lib/rankpilot", fsType: "ext4" },
];

/** The classic serverless/container layout: everything under a volatile mount. */
const EPHEMERAL_MOUNTS: MountInfo[] = [
  { mountPoint: "/", fsType: "overlay" },
  { mountPoint: "/app", fsType: "overlay" },
  { mountPoint: "/tmp", fsType: "tmpfs" },
];

function healthyInput(overrides: Partial<Parameters<typeof runPostDeployChecks>[0]> = {}) {
  return {
    baseUrl: "https://rankpilot.example.com",
    dbPath,
    backupDir,
    mounts: OVERLAY_MOUNTS,
    platform: "linux",
    live: { status: 200, body: { status: "live" } },
    ready: { status: 200, body: { status: "ready" } },
    configWarnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "postdeploy-"));
  dbDir = join(root, "data");
  backupDir = join(root, "backups");
  dbPath = join(dbDir, "rankpilot.db");
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(dbPath, "sqlite bytes");
  writeFileSync(join(backupDir, "rankpilot-2026-01-01T00-00-00-000Z.db.enc"), "ciphertext");
  // Keep the snapshot fresh so staleness is not the thing under test.
  const now = new Date();
  utimesSync(join(backupDir, "rankpilot-2026-01-01T00-00-00-000Z.db.enc"), now, now);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("parseMounts", () => {
  it("reads the real /proc/mounts format", () => {
    const sample = [
      "proc /proc proc rw,nosuid,relatime shared:5",
      "/dev/vda1 / ext4 rw,relatime 0 0",
      "tmpfs /tmp tmpfs rw,size=1G 0 0",
    ].join("\n");
    expect(parseMounts(sample)).toEqual([
      { mountPoint: "/proc", fsType: "proc" },
      { mountPoint: "/", fsType: "ext4" },
      { mountPoint: "/tmp", fsType: "tmpfs" },
    ]);
  });

  it("tolerates blank and malformed lines", () => {
    expect(parseMounts("\n\ngarbage\nonly-two-fields\n")).toEqual([]);
  });
});

describe("mountForPath", () => {
  it("picks the most specific mount, not the first", () => {
    const mounts = [
      { mountPoint: "/", fsType: "ext4" },
      { mountPoint: "/var", fsType: "tmpfs" },
      { mountPoint: "/var/lib/rankpilot", fsType: "ext4" },
    ];
    expect(mountForPath(mounts, "/var/lib/rankpilot/data/rankpilot.db")?.fsType).toBe("ext4");
    expect(mountForPath(mounts, "/var/log/app.log")?.fsType).toBe("tmpfs");
  });

  it("does not match a sibling path that merely shares a prefix", () => {
    // /var/lib/rankpilot must not capture /var/lib/rankpilot-staging.
    const mounts = [{ mountPoint: "/var/lib/rankpilot", fsType: "tmpfs" }];
    expect(mountForPath(mounts, "/var/lib/rankpilot-staging/db.sqlite")).toBeNull();
  });
});

describe("durabilityProblem", () => {
  it("accepts a path on a real filesystem", () => {
    expect(durabilityProblem("/var/lib/rankpilot/data/db", OVERLAY_MOUNTS, { platform: "linux" })).toBeNull();
  });

  it("rejects a database on a volatile filesystem", () => {
    const problem = durabilityProblem("/app/data/db", EPHEMERAL_MOUNTS, { platform: "linux" });
    expect(problem).toMatch(/overlay/);
    expect(problem).toMatch(/will be lost/);
  });

  it("rejects a database on tmpfs", () => {
    expect(durabilityProblem("/tmp/db", EPHEMERAL_MOUNTS, { platform: "linux" })).toMatch(/tmpfs/);
  });

  it("refuses to guess when the mount table is empty", () => {
    // Claiming durability we cannot prove is how a database gets lost.
    expect(durabilityProblem("/var/lib/db", [], { platform: "linux" })).toMatch(/could not read any mounts/);
  });

  it("refuses to guess on a platform it cannot inspect", () => {
    expect(durabilityProblem("/data/db", OVERLAY_MOUNTS, { platform: "darwin" })).toMatch(
      /cannot verify storage durability/
    );
    expect(durabilityProblem("/data/db", OVERLAY_MOUNTS, { platform: "win32" })).toMatch(
      /confirm .* by hand/
    );
  });
});

describe("runPostDeployChecks", () => {
  it("passes a healthy deploy on persistent storage", () => {
    const result = runPostDeployChecks(healthyInput());
    expect(result.pass).toBe(true);
    expect(result.checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("fails when the database is on a volatile mount, even though everything serves", () => {
    // This is the whole point. Live, ready, database file present, backup
    // present -- and the data is one restart from gone.
    const result = runPostDeployChecks(
      healthyInput({ mounts: EPHEMERAL_MOUNTS, dbPath: "/app/data/rankpilot.db" })
    );
    expect(result.pass).toBe(false);
    const durability = result.checks.find((c) => c.name.includes("survives a restart"));
    expect(durability?.ok).toBe(false);
  });

  it("fails when the service is live but cannot reach its database", () => {
    const result = runPostDeployChecks(
      healthyInput({ ready: { status: 503, body: { status: "not_ready" } } })
    );
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "liveness")?.ok).toBe(true);
    expect(result.checks.find((c) => c.name.startsWith("readiness"))?.ok).toBe(false);
  });

  it("fails when the service does not answer at all", () => {
    const result = runPostDeployChecks(
      healthyInput({ live: { status: 0, body: null }, ready: { status: 0, body: null } })
    );
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "liveness")?.detail).toMatch(/not serving/);
  });

  it("fails when the database file is missing entirely", () => {
    const result = runPostDeployChecks(healthyInput({ dbPath: join(root, "nope", "rankpilot.db") }));
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "database file exists")?.detail).toMatch(
      /migrations have not run/
    );
  });

  it("fails when no backup has ever been taken", () => {
    const empty = join(root, "empty-backups");
    mkdirSync(empty, { recursive: true });
    const result = runPostDeployChecks(healthyInput({ backupDir: empty }));
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "a recent backup exists")?.detail).toMatch(
      /not running/
    );
  });

  it("fails when the backup is stale, which means the scheduled job died", () => {
    const old = new Date(Date.now() - 72 * 3_600_000);
    const file = join(backupDir, "rankpilot-2026-01-01T00-00-00-000Z.db.enc");
    utimesSync(file, old, old);
    const result = runPostDeployChecks(healthyInput());
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "a recent backup exists")?.detail).toMatch(/STALE/);
  });

  it("uses BACKUP_STALE_HOURS rather than a hardcoded limit", () => {
    // The deploy check once hardcoded 26h while the admin dashboard read
    // BACKUP_STALE_HOURS, so an operator could be told the backup was fine by one
    // and stale by the other. A loose limit must now widen this check too.
    const age = new Date(Date.now() - 40 * 3_600_000);
    const file = join(backupDir, "rankpilot-2026-01-01T00-00-00-000Z.db.enc");
    utimesSync(file, age, age);

    const previous = process.env.BACKUP_STALE_HOURS;
    try {
      process.env.BACKUP_STALE_HOURS = "48";
      expect(
        runPostDeployChecks(healthyInput()).checks.find(
          (c) => c.name === "a recent backup exists"
        )?.ok
      ).toBe(true);

      process.env.BACKUP_STALE_HOURS = "12";
      expect(
        runPostDeployChecks(healthyInput()).checks.find(
          (c) => c.name === "a recent backup exists"
        )?.ok
      ).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.BACKUP_STALE_HOURS;
      else process.env.BACKUP_STALE_HOURS = previous;
    }
  });

  it("reports configuration warnings without failing the deploy", () => {
    const result = runPostDeployChecks(
      healthyInput({ configWarnings: ["EMAIL_WEBHOOK_URL is not set"] })
    );
    expect(result.pass).toBe(true);
    const warning = result.checks.find((c) => c.name === "configuration warning");
    expect(warning?.warning).toBe(true);
    expect(warning?.ok).toBe(true);
  });
});

describe("probe target", () => {
  // The script used to read RANKPILOT_PUBLIC_URL directly, which is the
  // lowest-precedence of four spellings. A deploy that followed the documented
  // setup and set SITE_URL was therefore probed at 127.0.0.1:3000 while the app
  // served its real origin: the health probes and the public site were two
  // different hosts, and the check passed on the wrong one.
  const script = readFileSync(join(process.cwd(), "scripts", "post-deploy-check.ts"), "utf8");

  it("resolves the base URL through the app's own resolver", () => {
    expect(script).toContain("siteUrl()");
    expect(script).not.toMatch(/process\.env\.RANKPILOT_PUBLIC_URL\s*\|\|/);
  });

  it("says which origin it probed, so a localhost pass is not mistaken for a public one", () => {
    expect(script).toContain("Probing ${baseUrl}");
    expect(script).toContain("siteUrlProblem");
  });
});

describe("formatResult", () => {
  it("tells you not to send real users to a failed deploy", () => {
    const result = runPostDeployChecks(healthyInput({ live: { status: 0, body: null } }));
    expect(formatResult(result)).toMatch(/Do not send real users here yet/);
  });

  it("still says what passed when something failed", () => {
    const result = runPostDeployChecks(healthyInput({ live: { status: 0, body: null } }));
    const text = formatResult(result);
    expect(text).toMatch(/PASS\s+readiness/);
    expect(text).toMatch(/FAIL\s+liveness/);
  });
});
