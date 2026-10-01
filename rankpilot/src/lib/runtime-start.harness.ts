/**
 * Test harness for the startup path.
 *
 * `startRuntime()` is the thing that must exit the process when configuration
 * is broken, and asserting that from inside the test process is impossible: the
 * call under test calls `process.exit(1)`, which would kill the test runner.
 * So the suite spawns this file as a child and inspects how it dies.
 *
 * Kept as a real file rather than `tsx -e` so the relative import and the
 * tsconfig path alias resolve the same way they do in production.
 */
import { startRuntime } from "./runtime-start";

startRuntime().catch(() => {
  // startRuntime handles its own failures and exits; this is only reached if it
  // somehow rejected, which is also a failed boot.
  process.exit(2);
});
