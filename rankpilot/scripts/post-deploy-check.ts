/**
 * CLI: verify a running deployment.
 *
 * Run this on the host after every deploy. It is the step that turns "the
 * process started" into "the service is serving and its data survives a
 * restart", which is the only claim worth making about a production deploy.
 *
 * Exits non-zero when a blocking check fails, so it can gate a release.
 */
import { productionConfigWarnings } from "../src/lib/config";
import { resolveDataPaths } from "../src/lib/deploy-preflight";
import { formatResult, parseMounts, runPostDeployChecks } from "../src/lib/post-deploy-check";
import { siteUrl, siteUrlProblem, siteUrlSource } from "../src/lib/site-url";
import { readFileSync } from "node:fs";

/**
 * Resolved through the app's own resolver rather than by reading
 * RANKPILOT_PUBLIC_URL directly. That variable is only the lowest-precedence
 * spelling of four (SITE_URL, NEXT_PUBLIC_SITE_URL, APP_URL, RANKPILOT_PUBLIC_URL),
 * so a deployment that followed the documented setup and set SITE_URL was probed
 * at 127.0.0.1:3000 while the app served its real origin -- the health probes and
 * the public site were two different hosts, and the check passed on one of them.
 */
const baseUrl = siteUrl();
const { db, backups } = resolveDataPaths(process.env);

if (!siteUrlSource()) {
  console.warn(
    "WARNING  No public origin configured (set SITE_URL); probing the local default. " +
      "This verifies the process, not the public site."
  );
}

async function probe(path: string): Promise<{ status: number; body: unknown }> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Leave as text; a non-JSON body still tells us it answered.
    }
    return { status: response.status, body };
  } catch (error) {
    // Status 0 means unreachable, which is distinct from an HTTP error status.
    return { status: 0, body: (error as Error).message };
  }
}

// Wrapped rather than using top-level await: this file is compiled as CommonJS,
// which does not support it. Same shape as scripts/http-load.ts.
async function main(): Promise<void> {
  let mounts = parseMounts("");
  try {
    mounts = parseMounts(readFileSync("/proc/mounts", "utf8"));
  } catch {
    // Non-Linux or unreadable. durabilityProblem() will refuse to guess.
  }

  const result = runPostDeployChecks({
    baseUrl,
    dbPath: db,
    backupDir: backups,
    mounts,
    live: await probe("/api/health/live"),
    ready: await probe("/api/health/ready"),
    configWarnings: productionConfigWarnings(),
  });

  // The site URL is reported by productionConfigWarnings() already, but the
  // problem is only non-null for an unusable value -- never for "unset in
  // production" when NODE_ENV is not set on the host. Asking here means the
  // post-deploy check states plainly which origin it probed, because a green
  // run against localhost is worth much less than it looks.
  const siteProblem = siteUrlProblem(process.env, { production: true });
  console.log(`Probing ${baseUrl} (from ${siteUrlSource() ?? "built-in default"})`);
  if (siteProblem) console.warn(`WARNING  ${siteProblem}`);

  console.log(formatResult(result));
  if (!result.pass) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(`post-deploy check could not run: ${(error as Error).message}`);
  process.exit(1);
});
