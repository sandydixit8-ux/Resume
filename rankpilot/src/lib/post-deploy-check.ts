/**
 * Post-deployment verification.
 *
 * The preflight checks the configuration you *meant* to set. This checks the
 * host you actually landed on, which is a different question and the one that
 * matters. A deploy can pass every preflight check and still be one `systemctl
 * restart` away from total data loss, because the database landed on a tmpfs.
 *
 * Every check here is observable from outside the process, deliberately. The app
 * cannot vouch for itself: a bug in the app must not be able to also disable the
 * thing that notices the bug.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { staleAfterHours } from "@/lib/backup-status";

export interface Check {
  name: string;
  ok: boolean;
  /** Why it failed, or a short confirmation. */
  detail: string;
  /** Failures here are survivable but should be acted on. */
  warning?: boolean;
}

export interface PostDeployResult {
  checks: Check[];
  pass: boolean;
}

/**
 * Filesystem types that do not survive a redeploy or reboot. This is the check
 * that catches silent total data loss: the app runs perfectly, the database file
 * exists, every request succeeds, and then the platform reaps the container.
 */
const VOLATILE_FS_TYPES = ["tmpfs", "overlay", "ramfs", "devtmpfs", "squashfs", "aufs"];

export interface MountInfo {
  /** Mount point, e.g. "/var/lib/rankpilot". */
  mountPoint: string;
  /** Filesystem type from /proc/mounts. */
  fsType: string;
}

/** Parses Linux /proc/mounts. Returns [] on non-Linux so callers can decide. */
export function parseMounts(contents: string): MountInfo[] {
  return contents
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 3)
    .map((parts) => ({ mountPoint: parts[1], fsType: parts[2] }));
}

/** Comparable form: forward slashes, no trailing slash, drive letter kept. */
function normaliseForCompare(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "") || "/";
}

/** The most specific mount containing `path`. */
export function mountForPath(mounts: MountInfo[], path: string): MountInfo | null {
  const target = normaliseForCompare(resolve(path));
  let best: MountInfo | null = null;
  let bestLength = -1;
  for (const mount of mounts) {
    const point = normaliseForCompare(resolve(mount.mountPoint));
    // Prefix match on a path boundary, so /var/lib/rankpilot never captures
    // /var/lib/rankpilot-staging. Comparing on a separator-normalised form is
    // what makes this work on Windows too, where resolve() returns backslashes.
    const contains = target === point || target.startsWith(point === "/" ? "/" : `${point}/`);
    if (contains && point.length > bestLength) {
      best = mount;
      bestLength = point.length;
    }
  }
  return best;
}

/**
 * Is this path on storage that survives a restart?
 *
 * Returns a reason string when durability cannot be established, or null when it
 * can. Fails closed on an unparseable mount table: claiming durability we cannot
 * prove is how a database gets lost.
 */
export function durabilityProblem(
  path: string,
  mounts: MountInfo[],
  { platform = process.platform }: { platform?: string } = {}
): string | null {
  if (platform !== "linux") {
    // /proc/mounts is Linux-only. Refuse to guess rather than assert safety.
    return `cannot verify storage durability on ${platform}: mount table is Linux-only, so confirm ${path} is on a persistent disk by hand`;
  }
  if (mounts.length === 0) {
    return "could not read any mounts, so storage durability could not be established";
  }
  const mount = mountForPath(mounts, path);
  if (!mount) {
    return `no mount contains ${path}, so its durability is unknown`;
  }
  if (VOLATILE_FS_TYPES.includes(mount.fsType)) {
    return `${path} is on a ${mount.fsType} mount (${mount.mountPoint}), which does not survive a redeploy or reboot. The database will be lost. Attach a persistent volume and point RANKPILOT_DB_PATH at it`;
  }
  return null;
}

export interface PostDeployInput {
  baseUrl: string;
  dbPath: string;
  backupDir: string;
  mounts?: MountInfo[];
  platform?: string;
  /** Live result of GET /api/health/live. */
  live: { status: number; body: unknown };
  /** Live result of GET /api/health/ready. */
  ready: { status: number; body: unknown };
  /** Non-fatal configuration warnings surfaced at boot. */
  configWarnings?: string[];
  now?: Date;
}

function countSnapshots(
  dir: string,
  now: Date
): { count: number; newestAgeHours: number | null } {
  try {
    const entries = readdirSync(dir).filter(
      (f) => f.startsWith("rankpilot-") && (f.endsWith(".db") || f.endsWith(".db.enc"))
    );
    if (entries.length === 0) return { count: 0, newestAgeHours: null };
    const newest = Math.max(...entries.map((f) => statSync(resolve(dir, f)).mtimeMs));
    return { count: entries.length, newestAgeHours: Math.max(0, (now.getTime() - newest) / 3_600_000) };
  } catch {
    return { count: 0, newestAgeHours: null };
  }
}

/**
 * Runs every post-deploy check and returns a verdict.
 *
 * `live`/`ready` results are passed in rather than fetched here, so the decision
 * logic is unit-testable and so a single fetch failure cannot be confused with a
 * failing health check.
 */
export function runPostDeployChecks(input: PostDeployInput): PostDeployResult {
  const checks: Check[] = [];
  const { baseUrl, dbPath, backupDir, platform = process.platform } = input;

  // --- The service answers at all -----------------------------------------
  checks.push({
    name: "liveness",
    ok: input.live.status === 200,
    detail:
      input.live.status === 200
        ? `GET ${baseUrl}/api/health/live -> 200`
        : `GET ${baseUrl}/api/health/live -> ${input.live.status}. The service is not serving.`,
  });

  // --- And it can actually reach the database ------------------------------
  // Separate from liveness on purpose: a server that boots but cannot open the
  // database is live, not ready, and serving 200s from liveness proves nothing.
  checks.push({
    name: "readiness (database reachable)",
    ok: input.ready.status === 200,
    detail:
      input.ready.status === 200
        ? `GET ${baseUrl}/api/health/ready -> 200`
        : `GET ${baseUrl}/api/health/ready -> ${input.ready.status}. The service cannot reach its database.`,
  });

  // --- The database is where we think it is, and it still exists ------------
  const dbExists = existsSync(dbPath);
  checks.push({
    name: "database file exists",
    ok: dbExists,
    detail: dbExists
      ? `${dbPath} (${(statSync(dbPath).size / 1024).toFixed(0)} KiB)`
      : `No database at ${dbPath}. RANKPILOT_DB_PATH is wrong, or migrations have not run.`,
  });

  // --- And it will still be there after a restart --------------------------
  const mounts = input.mounts ?? parseMounts(safeRead("/proc/mounts"));
  const durability = durabilityProblem(dbPath, mounts, { platform });
  checks.push({
    name: "database survives a restart",
    ok: durability === null,
    detail: durability ?? `${dbPath} is on persistent storage`,
  });

  const backupDurability = durabilityProblem(backupDir, mounts, { platform });
  checks.push({
    name: "backups survive a restart",
    ok: backupDurability === null,
    detail:
      backupDurability ??
      `${backupDir} is on persistent storage`,
  });

  // --- A backup has actually been taken ------------------------------------
  // The threshold comes from the same place GET /api/admin/status reads it, so a
  // deployment cannot be judged healthy while the admin dashboard calls the same
  // backup stale (they previously disagreed because 26 was hardcoded here).
  const staleLimit = staleAfterHours();
  const snapshots = countSnapshots(backupDir, input.now ?? new Date());
  const isStale = snapshots.newestAgeHours !== null && snapshots.newestAgeHours > staleLimit;
  checks.push({
    name: "a recent backup exists",
    ok: snapshots.count > 0 && snapshots.newestAgeHours !== null && !isStale,
    detail:
      snapshots.count === 0
        ? `No snapshots in ${backupDir}. The scheduled backup is not running.`
        : `${snapshots.count} snapshot(s), newest is ${snapshots.newestAgeHours?.toFixed(1)}h old` +
          (isStale
            ? ` - STALE, older than the ${staleLimit}h limit, so the backup job is not keeping up`
            : ""),
    warning: false,
  });

  // --- Known configuration debt, reported but not fatal --------------------
  for (const warning of input.configWarnings ?? []) {
    checks.push({
      name: "configuration warning",
      ok: true,
      detail: warning,
      warning: true,
    });
  }

  const blocking = checks.filter((c) => !c.ok && !c.warning);
  return { checks, pass: blocking.length === 0 };
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function formatResult(result: PostDeployResult): string {
  const lines = result.checks.map((c) => {
    const mark = c.ok ? (c.warning ? "WARN " : "PASS ") : "FAIL ";
    return `${mark}  ${c.name}: ${c.detail}`;
  });
  lines.push("");
  lines.push(
    result.pass
      ? "POST-DEPLOY CHECKS PASSED. The service is serving and its data survives a restart."
      : "POST-DEPLOY CHECKS FAILED. Do not send real users here yet."
  );
  return lines.join("\n");
}
