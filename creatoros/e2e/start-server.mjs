import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Starts a fresh Next dev server against a dedicated E2E database.
// Resets + reseeds the DB first so every run is deterministic.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(root, "data", "e2e.db");
process.env.CREATOROS_DB_PATH = dbPath;
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "e2e-secret-with-enough-entropy-1234";

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(dbPath + suffix, { force: true });
}

const win = process.platform === "win32";
const comspec = process.env.ComSpec || "cmd.exe";
const run = (args) =>
  execFileSync(win ? comspec : "npx", win ? ["/c", `npx ${args.join(" ")}`] : args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

run(["tsx", "scripts/init-db.ts"]);
run(["tsx", "scripts/seed.ts"]);
run(["tsx", "scripts/seed-e2e.ts"]);

const child = spawn(win ? comspec : "npx", win ? ["/c", "npx next dev"] : ["next", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));