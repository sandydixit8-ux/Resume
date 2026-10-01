import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Points every test at its own throwaway database.
 *
 * Without this, `npm test` opens `data/rankpilot.db` — the developer's actual
 * working database. Two things went wrong because of that:
 *
 *   1. Running the suite mutated real local data. It left users, organizations
 *      and memberships behind, and a test that deletes rows to set up its
 *      scenario can delete a developer's saved work.
 *   2. Suites ran in parallel against one shared file, so a test that clears a
 *      table raced every other suite. That surfaced as a FOREIGN KEY failure
 *      in the password-reset suite caused by the erasure suite's setup.
 *
 * A per-worker file fixes the collision properly: each worker gets its own
 * database, so the only state left shared between tests in one file is state
 * they created themselves.
 *
 * This must run before any module calls `getDb()`, since that function caches
 * the connection and resolves the path from the environment on first use.
 * `setupFiles` gives us that ordering guarantee.
 */

// Normally provided by global-setup.ts, which owns the cleanup. The fallback
// keeps a directly-invoked run from silently using the developer's real
// database; those files leak, but leaking a temp file is the safe failure mode.
const dir = process.env.RANKPILOT_TEST_DIR ?? mkdtempSync(join(tmpdir(), "rankpilot-test-orphan-"));

// Vitest exposes the worker id; the fallback keeps this usable if a test file is
// ever run by a runner that does not set it.
const worker = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "1";
process.env.RANKPILOT_DB_PATH = join(dir, `worker-${worker}.db`);

// Keep the audit-retention test deterministic rather than inheriting whatever
// the developer's shell happens to have set.
process.env.FREE_AUDIT_RETENTION_DAYS ??= "30";
