import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // scripts/ is included so the backup command's own end-to-end behaviour is
    // covered; the unit tests under src/ cannot see scripts/backup.ts.
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    // Must stay first: it repoints RANKPILOT_DB_PATH at a throwaway per-worker
    // database before anything opens a connection. See src/test/setup-db.ts.
    setupFiles: ["src/test/setup-db.ts"],
    // Owns the scratch directory and removes it after the run, which
    // per-worker setup cannot do reliably inside worker threads.
    globalSetup: ["src/test/global-setup.ts"],
    // Suites now have a database each, so they can run in parallel. Excluding
    // DB-touching files from a single fork would serialise the whole suite.
    pool: "threads",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
