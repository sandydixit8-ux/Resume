/**
 * Pre-deployment checks.
 *
 * A green test suite proves the code works. It says nothing about whether the
 * thing it runs against will still exist tomorrow, and the failure mode here is
 * silent: a SQLite database on an ephemeral filesystem keeps working perfectly
 * right up until the platform reaps the container, and then it is simply gone,
 * along with every backup written beside it.
 *
 * So this module is deliberately strict, and deliberately refuses to guess. The
 * default is to fail closed. Every blocker has an explicit opt-out flag for the
 * cases where a human has decided the risk is acceptable, which keeps the
 * decision visible in a deploy log instead of buried in a config default.
 */

import { existsSync, statSync, mkdirSync, accessSync, constants } from "node:fs";
import { dirname, isAbsolute, sep } from "node:path";
import { authSecretProblem, MIN_SECRET_LENGTH, PLACEHOLDER_SECRET } from "./config";
import { backupDirectory } from "./backup-status";
import { databasePath, databasePathOverride } from "./db/db";

export interface PreflightResult {
  blockers: string[];
  warnings: string[];
  notes: string[];
}

export interface PreflightOptions {
  /** Allow deploying with plaintext backups. */
  allowPlaintextBackups?: boolean;
  /** Allow deploying with no working password reset. */
  allowNoEmail?: boolean;
  /** Allow a relative (implicitly cwd-dependent) database path. */
  allowRelativeDbPath?: boolean;
}

/**
 * Paths that are conventionally wiped between deploys or between container
 * starts. A database here will work perfectly and then vanish.
 */
const EPHEMERAL_PREFIXES = [
  "/tmp",
  "/var/task", // AWS Lambda
  "/dev/shm",
  "/run",
  "/home/runner/work", // CI
];

/**
 * True when the path sits under a conventionally-wiped location.
 *
 * The drive letter is stripped first. Without that, `C:/tmp/...` and every other
 * Windows absolute path fails to match `/tmp`, and this check silently does
 * nothing on Windows -- which is exactly the case where an operator testing a
 * deploy locally would get false reassurance before deploying to Linux.
 *
 * Deliberately does not treat the OS temp directory as ephemeral on every
 * platform. On Windows and macOS the temp directory sits under the user profile
 * and survives restarts, so flagging it would block legitimate deploys until
 * people learned to bypass the check -- which defeats the purpose. On Linux it
 * is `/tmp`, already listed above.
 */
export function looksEphemeral(absolutePath: string): boolean {
  const normalised = absolutePath.replace(/\\/g, "/").toLowerCase().replace(/^[a-z]:\//, "/");
  return EPHEMERAL_PREFIXES.some(
    (prefix) => normalised === prefix || normalised.startsWith(`${prefix}/`)
  );
}

function writableDir(path: string): string | null {
  try {
    if (!existsSync(path)) return `"${path}" does not exist`;
    if (!statSync(path).isDirectory()) return `"${path}" is not a directory`;
    accessSync(path, constants.W_OK);
    return null;
  } catch (error) {
    return `"${path}" is not writable (${(error as Error).message})`;
  }
}

/**
 * Resolves the database and backup directories the same way the application
 * does. If these disagree, every check below is theatre.
 */
export function resolveDataPaths(env: Record<string, string | undefined>): { db: string; backups: string } {
  // Both paths are delegated rather than re-derived here. If these disagree,
  // every check below is theatre: the preflight would approve a database the app
  // never opens, or a backup directory nobody writes to.
  return { db: databasePath(env), backups: backupDirectory(env) };
}

/**
 * Runs every check. `env` is injected rather than read from `process.env` so the
 * whole thing is testable, and so a deploy pipeline can check a candidate
 * environment without mutating its own.
 */
export function runDeployPreflight(
  env: Record<string, string | undefined> = process.env,
  options: PreflightOptions = {}
): PreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const { db, backups } = resolveDataPaths(env);

  // --- Secrets -------------------------------------------------------------
  const secretProblem = authSecretProblem(env.AUTH_SECRET);
  if (secretProblem) {
    blockers.push(
      `${secretProblem}. Generate one with: openssl rand -base64 32 (${MIN_SECRET_LENGTH}+ random characters).`
    );
  }

  // --- Database durability -------------------------------------------------
  // The most dangerous line in this file. A relative default means the database
  // lands wherever the platform happens to put the app, which on a container or
  // serverless host is disposable.
  // Asked of the shared resolver rather than re-derived: what matters here is
  // whether *any* explicit path was set, not what the fallback resolves to.
  const rawDb = databasePathOverride(env);
  if (!rawDb) {
    blockers.push(
      "RANKPILOT_DB_PATH is not set. The app would fall back to a relative path under the working directory, " +
        "which is ephemeral on most container and serverless hosts. Set it to an absolute path on a persistent volume."
    );
  } else if (!isAbsolute(rawDb) && !options.allowRelativeDbPath) {
    blockers.push(
      `RANKPILOT_DB_PATH ("${rawDb}") is relative. It will resolve against whatever the process working ` +
        "directory happens to be, which differs between a build and a run. Set an absolute path."
    );
  }

  if (looksEphemeral(db)) {
    blockers.push(
      `RANKPILOT_DB_PATH resolves to "${db}", which is under an ephemeral path that platforms conventionally ` +
        "wipe between deploys or container restarts. The database will be lost. Mount a persistent volume."
    );
  }

  const dbDir = dirname(db);
  const dbDirProblem = writableDir(dbDir);
  if (dbDirProblem) {
    blockers.push(`Database directory is unusable: ${dbDirProblem}. Create it or point RANKPILOT_DB_PATH elsewhere.`);
  }

  if (!existsSync(db)) {
    warnings.push(
      `No database at ${db}. That is expected on a first deploy, but confirm migrations are run before serving traffic.`
    );
  }

  // --- Backups -------------------------------------------------------------
  if (!env.BACKUP_PASSPHRASE?.trim() && !options.allowPlaintextBackups) {
    blockers.push(
      "BACKUP_PASSPHRASE is not set, so backups would be written as plaintext containing user emails and " +
        "password hashes. Set it, or pass --allow-plaintext-backups to accept that."
    );
  }

  const retention = Number(env.BACKUP_RETENTION_DAYS);
  if (!Number.isFinite(retention) || retention <= 0) {
    blockers.push(
      "BACKUP_RETENTION_DAYS is not set to a positive number. A scheduled backup with no retention grows " +
        "without bound and will eventually fill the disk and take the database down with it."
    );
  }

  const backupDirProblem = writableDir(backups);
  if (backupDirProblem) {
    // Do not create it: a preflight that fixes its own problems reports success
    // for a directory nobody has deliberately provisioned.
    warnings.push(
      `Backup directory is not ready: ${backupDirProblem}. Create it before the first scheduled backup, ` +
        "or backups will fail at 3am."
    );
  }

  if (looksEphemeral(backups)) {
    blockers.push(
      `RANKPILOT_BACKUP_DIR resolves to "${backups}", an ephemeral path. Backups there protect nothing, ` +
        "because they are destroyed along with the database."
    );
  }

  if (backups.startsWith(dbDir + sep) || dbDir.startsWith(backups + sep)) {
    warnings.push(
      "The backup directory is inside the database directory (or vice versa). They will share one volume, so a " +
        "single disk failure takes both."
    );
  }

  // --- Email ---------------------------------------------------------------
  const emailUrl = env.EMAIL_WEBHOOK_URL?.trim();
  if (!emailUrl && !options.allowNoEmail) {
    blockers.push(
      "EMAIL_WEBHOOK_URL is not set, so password reset and email verification return 503. Every user who " +
        "forgets their password would be permanently locked out with no way to recover. Set it, or pass " +
        "--allow-no-email to launch deliberately without account recovery."
    );
  } else if (!emailUrl) {
    warnings.push("Email is disabled by explicit choice. No user can reset a forgotten password.");
  } else if (!emailUrl.startsWith("https://") && !emailUrl.includes("localhost")) {
    blockers.push("EMAIL_WEBHOOK_URL is not https, so credentials cross the network in clear text.");
  }

  // --- Always true, worth saying out loud ----------------------------------
  notes.push(
    "SQLite is a single-writer store. Run exactly one application instance. Two replicas on one volume will " +
      "lock or corrupt the database; two on separate volumes will silently diverge."
  );
  notes.push(
    "A backup on the same disk is not a backup. Copy the ciphertext to separate storage, and keep the " +
      "passphrase somewhere that storage provider cannot reach."
  );
  if (env.NODE_ENV !== "production") {
    warnings.push(
      `NODE_ENV is "${env.NODE_ENV || "unset"}", not "production". Production configuration checks are skipped at boot.`
    );
  }
  if (PLACEHOLDER_SECRET.test(env.AUTH_SECRET ?? "")) {
    notes.push("AUTH_SECRET still matches a placeholder pattern.");
  }

  return { blockers, warnings, notes };
}

/** Convenience for the CLI: does the environment pass? */
export function canDeploy(result: PreflightResult): boolean {
  return result.blockers.length === 0;
}

/** Creates the data directories once the checks have approved the paths. */
export function ensureDirectories(env: Record<string, string | undefined> = process.env): void {
  const { db, backups } = resolveDataPaths(env);
  mkdirSync(dirname(db), { recursive: true });
  mkdirSync(backups, { recursive: true });
}

/**
 * True for the one blocker a `--init-dirs` run is allowed to resolve by creating
 * the directory. Matched on the shape of the message above rather than a code so
 * the CLI keeps working if that text is reworded, while a genuinely different
 * blocker (ephemeral path, relative path, missing passphrase) still stops the run.
 */
export function isMissingDirectoryBlocker(blocker: string): boolean {
  return /is unusable: ".*" does not exist\./.test(blocker);
}

export interface InitDirectoriesResult {
  created: boolean;
  /** Preflight re-run after creating, so the CLI reports the current truth. */
  result: PreflightResult;
  /** Why nothing was created, when nothing was. */
  reason?: string;
}

/**
 * `--init-dirs`, with the chicken-and-egg resolved.
 *
 * On a fresh host the database directory does not exist yet, and that is reported
 * as a blocker. Gating directory creation on "no blockers" therefore made this
 * flag a no-op on exactly the machines that needed it. Instead: create the
 * directories only when a missing directory is the *sole* reason the deploy is
 * blocked. If anything else is wrong — an ephemeral path, a relative path, a
 * missing passphrase — creating a directory would paper over a real problem, so
 * nothing is touched and the blockers are reported as they are.
 */
export function initDirectories(
  env: Record<string, string | undefined> = process.env,
  options: PreflightOptions = {}
): InitDirectoriesResult {
  const before = runDeployPreflight(env, options);
  if (canDeploy(before)) {
    return { created: false, result: before, reason: "No blockers; the data directories are already deployable." };
  }
  const unfixable = before.blockers.filter((b) => !isMissingDirectoryBlocker(b));
  if (unfixable.length > 0) {
    return {
      created: false,
      result: before,
      reason:
        `Refusing to create directories while ${unfixable.length} configuration blocker(s) remain: ` +
        unfixable[0],
    };
  }
  ensureDirectories(env);
  return { created: true, result: runDeployPreflight(env, options) };
}
