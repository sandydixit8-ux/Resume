import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Creates one scratch directory for the whole test run and removes it after.
 *
 * Cleanup lives here rather than in the per-file setup file because vitest runs
 * test files in worker threads, where `process.on("exit")` does not reliably
 * fire. `globalSetup` runs once in the main process and its returned function
 * is awaited after every suite has finished, so the directory is actually
 * removed instead of accumulating dozens of leftovers per run.
 *
 * The directory name is passed to workers through the environment; see
 * `src/test/setup-db.ts` for the per-worker database file inside it.
 */
export default function globalSetup() {
  const dir = mkdtempSync(join(tmpdir(), "rankpilot-test-"));
  process.env.RANKPILOT_TEST_DIR = dir;

  return () => {
    try {
      // Retries matter on Windows: a worker thread's SQLite handle can still be
      // closing when the run finishes, and deleting a locked file fails with
      // EBUSY rather than succeeding quietly.
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      // A leftover temp directory is not worth failing a test run over.
    }
  };
}
