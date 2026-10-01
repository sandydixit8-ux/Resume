#!/usr/bin/env node
/**
 * Asserts the regression guards for previously-fixed bugs still exist.
 *
 * A test that gets deleted during a refactor is how a vulnerability quietly
 * comes back. This fails CI when a guard file or a specific test name
 * disappears, so removing one has to be a deliberate, visible act.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/** Each entry ties a fixed bug to the file and test name that guards it. */
const GUARDS = [
  {
    bug: "PDF byte corruption (/Length in bytes, not characters)",
    file: "src/lib/reports/pdf.test.ts",
    needles: ["byte", "Length", "xref"],
  },
  {
    bug: "CSV formula injection",
    file: "src/lib/reports/csv.test.ts",
    needles: ["formula", "=cmd", "'"],
  },
  {
    bug: "Login timing oracle (unknown accounts still hash)",
    file: "src/lib/auth/login-timing.test.ts",
    needles: ["DECOY", "timing", "unknown"],
  },
  {
    bug: "Worker process-killing rejection / orphaned jobs",
    file: "src/lib/jobs/worker-safety.test.ts",
    needles: ["unhandled rejection", "reaper", "max_attempts"],
  },
  {
    bug: "Unbounded heading amplification",
    file: "src/lib/crawler/parse-bounds.test.ts",
    needles: ["caps the number of headings", "h1", "text sample"],
  },
  {
    bug: "Health check answering 200 while the database is down",
    file: "src/app/api/health/health.test.ts",
    needles: ["503", "unavailable", "readiness"],
  },
  {
    bug: "Liveness depending on the database (restart loop)",
    file: "src/app/api/health/health.test.ts",
    needles: ["liveness", "live"],
  },
  {
    bug: "Session revocation missing on password reset",
    file: "src/lib/auth/reset.test.ts",
    needles: ["session", "revoke"],
  },
  {
    bug: "Rate limit bucket reset by an unrelated window / unbounded keyspace",
    file: "src/lib/security/rate-limit.test.ts",
    needles: ["window", "bound", "MAX_KEYS", "keyspace"],
  },
  {
    bug: "SSRF via redirect and DNS rebinding",
    file: "src/lib/crawler/redirect.test.ts",
    needles: ["redirect", "127.0.0.1", "private"],
  },
  {
    bug: "Forged X-Forwarded-For when no proxy is trusted",
    file: "src/lib/http-ip.test.ts",
    needles: ["x-forwarded-for", "forged", "trust"],
  },
  {
    bug: "Unauthenticated write routes left unthrottled",
    file: "src/lib/auth/rbac.test.ts",
    needles: ["rate limits the unauthenticated write endpoints", "mustThrottle"],
  },
  {
    bug: "Backup taken as plaintext while claiming to be encrypted",
    file: "src/lib/backup-crypto.test.ts",
    needles: ["wrong passphrase", "tamper", "truncat"],
  },
  {
    bug: "User erasure leaves IP addresses in the audit trail",
    file: "src/lib/privacy/erasure.test.ts",
    needles: ["ip update keyed on", "expect(aLog.ip).toBeNull()"],
  },
  {
    bug: "Erasure claims success while nested PII survives in audit meta",
    file: "src/lib/privacy/erasure.test.ts",
    needles: ["scrubs identifying keys nested inside meta", "secret fingerprint"],
  },
  {
    bug: "Erasure reports success with foreign key enforcement disabled",
    file: "src/lib/privacy/erasure.test.ts",
    needles: ["foreign_keys", "assertCascadesEnabled"],
  },
  {
    bug: "Error boundary tells the user their data is safe when it may not be",
    file: "src/app/global-error.test.ts",
    needles: ["not.tomatch(/data has not been affected", "duplicate"],
  },
  {
    bug: "Startup continues with a missing AUTH_SECRET and serves only 500s",
    file: "src/lib/config.test.ts",
    needles: ["auth_secret", "not set"],
  },
  {
    bug: "Runtime start swallows the failure and keeps the port bound",
    file: "src/lib/runtime-start.ts",
    needles: ["process.exit(1)", "failed to start"],
  },
  {
    bug: "Erasure endpoint lets a non-owner or an unconfirmed call destroy a tenant",
    file: "src/app/api/admin/erasure/route.test.ts",
    needles: ["billing:write", "confirmtenantid", "dry run unless confirm"],
  },
  {
    bug: "Test suite runs against the developer's working database",
    file: "src/test/isolation.test.ts",
    needles: ["not.toBe(repoDb)", "does not leave rows in the repository database"],
  },
  {
    bug: "A silently dead backup job looks healthy because a restore-check file was counted",
    file: "src/lib/backup-status.test.ts",
    needles: ["does not count a restore-check artifact as a backup", "never-taken"],
  },
  {
    bug: "Backup status reads a different directory than the backup script writes to",
    file: "src/lib/backup-status.test.ts",
    needles: ["reads the same environment variable the backup script writes to", "process.env.RANKPILOT_BACKUP_DIR"],
  },
  {
    bug: "db:restore-test leaves a snapshot behind on every CI run",
    file: "scripts/backup.e2e.test.ts",
    needles: ["verifies a restore without leaving a snapshot behind", "BACKUP_KEEP_VERIFY_SNAPSHOT"],
  },
  {
    bug: "Backup verification only ever read back a snapshot it had just taken, never an aged one",
    file: "scripts/backup.e2e.test.ts",
    needles: [
      "restores a snapshot that is days old, and reports its age",
      "warns when the newest retained snapshot is older than the staleness limit",
      "fails when the snapshot is encrypted and the passphrase is unavailable",
      "fails loudly when the backup directory is empty, rather than reporting success",
    ],
  },
  {
    bug: "Routine backups are left in plaintext on disk",
    file: "scripts/backup.e2e.test.ts",
    needles: ["leaves ciphertext on disk and no plaintext snapshot", "leak-canary@example.com"],
  },
  {
    bug: "Deploy preflight loses the ephemeral-path check on Windows drive-letter paths",
    file: "src/lib/deploy-preflight.test.ts",
    needles: [
      "detects ephemeral paths given in Windows form",
      "does not mistake a persistent path for an ephemeral one",
    ],
  },
  {
    bug: "Deploy preflight does not block an unconfigured production environment",
    file: "src/lib/deploy-preflight.test.ts",
    needles: ["passes a correctly configured production environment", "permanently locked out"],
  },
  {
    bug: "Any user can self-serve a free upgrade to the top paid plan",
    file: "src/lib/billing/plan-access.test.ts",
    needles: [
      "denies everyone when the allowlist is unset (the default)",
      "not fooled by a substring",
    ],
  },
  {
    bug: "Plan ordering would let an unknown plan bypass the upgrade gate",
    file: "src/lib/plans.test.ts",
    needles: [
      "ranks plans from cheapest to most expensive",
      "ranks unknown plans as free, the safe direction",
    ],
  },
  {
    bug: "Deploy preflight and the status endpoint resolve different backup directories",
    file: "src/lib/deploy-preflight.test.ts",
    needles: [
      "resolves the backup path through the same function the status endpoint uses",
    ],
  },
  {
    bug: "Post-deploy check hardcodes a backup staleness limit the admin dashboard disagrees with",
    file: "src/lib/post-deploy-check.test.ts",
    needles: ["uses BACKUP_STALE_HOURS rather than a hardcoded limit"],
  },
  {
    bug: "The database path rule was hand-copied into four call sites and silently drifted",
    file: "src/lib/deploy-preflight.test.ts",
    needles: ["resolves the database path through the same function the app opens"],
  },
  {
    bug: "The systemd unit ran a plain preflight before --init-dirs, so it could not bootstrap a fresh host",
    file: "src/lib/deploy-service-file.test.ts",
    needles: [
      "runs the directory-initialising preflight before the plain one",
      "applies migrations as part of the start, not as a manual step",
      "points at documentation that exists in the repository",
    ],
  },
  {
    bug: "Post-deploy check probed RANKPILOT_PUBLIC_URL directly, so SITE_URL deploys were checked on the wrong host",
    file: "src/lib/post-deploy-check.test.ts",
    needles: [
      "resolves the base URL through the app's own resolver",
      "says which origin it probed, so a localhost pass is not mistaken for a public one",
    ],
  },
  {
    bug: "--init-dirs was a no-op on a fresh host, because the missing directory is itself a blocker",
    file: "src/lib/deploy-preflight.test.ts",
    needles: [
      "creates the directories on a fresh host, where a missing directory is the only blocker",
      "refuses to create anything while a real configuration blocker remains",
    ],
  },
];

let failures = 0;
console.log("Regression guard check\n");

for (const guard of GUARDS) {
  const full = path.join(process.cwd(), guard.file);
  if (!existsSync(full)) {
    console.log(`  FAIL  ${guard.bug}\n          missing file: ${guard.file}`);
    failures++;
    continue;
  }
  const src = readFileSync(full, "utf8").toLowerCase();
  const missing = guard.needles.filter((n) => !src.includes(n.toLowerCase()));
  if (missing.length > 0) {
    console.log(`  FAIL  ${guard.bug}\n          ${guard.file} no longer asserts: ${missing.join(", ")}`);
    failures++;
  } else {
    console.log(`  PASS  ${guard.bug}`);
  }
}

console.log(`\n${GUARDS.length - failures}/${GUARDS.length} regression guards present`);
if (failures > 0) {
  console.error("\nA regression guard was removed or weakened. Restore it, or document why in the PR.");
  process.exit(1);
}
