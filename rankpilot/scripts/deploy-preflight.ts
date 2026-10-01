/**
 * CLI for the deployment preflight. Exits non-zero when the environment is not
 * safe to deploy into, so it can gate a deploy pipeline rather than only inform
 * a human.
 */
import { canDeploy, initDirectories, runDeployPreflight } from "../src/lib/deploy-preflight";

const args = new Set(process.argv.slice(2));

const options = {
  allowPlaintextBackups: args.has("--allow-plaintext-backups"),
  allowNoEmail: args.has("--allow-no-email"),
  allowRelativeDbPath: args.has("--allow-relative-db-path"),
};

if (args.has("--init-dirs")) {
  // Directories are created only when a missing directory is the sole blocker.
  // Resolving a real configuration problem by creating a directory would make
  // the preflight report success for a host it has not actually approved.
  const init = initDirectories(process.env, options);
  console.log(init.created ? "Created data directories." : `Nothing created: ${init.reason}`);
}

const result = runDeployPreflight(process.env, options);

for (const blocker of result.blockers) console.error(`BLOCKER  ${blocker}`);
for (const warning of result.warnings) console.warn(`WARNING  ${warning}`);
for (const note of result.notes) console.log(`NOTE     ${note}`);

if (!canDeploy(result)) {
  console.error(
    `\nDEPLOY BLOCKED: ${result.blockers.length} problem(s) must be resolved, or the matching --allow-* flag ` +
      `used to record that a human accepted the risk.`
  );
  process.exit(1);
}

console.log(
  `\nPreflight passed${result.warnings.length ? ` with ${result.warnings.length} warning(s)` : ""}. ` +
    `This checks configuration only; it does not prove the app runs on this host.`
);
