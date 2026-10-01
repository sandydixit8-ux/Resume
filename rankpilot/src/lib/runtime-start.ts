/**
 * Node-runtime startup.
 *
 * Lives in its own module because `instrumentation.ts` is also compiled for the
 * Edge runtime, where `process` does not exist. Importing this dynamically from
 * inside the node-only branch keeps `process.exit` out of the Edge bundle
 * instead of tripping the "Node.js API used in the Edge Runtime" warning.
 */

export async function startRuntime(): Promise<void> {
  try {
    // Fail at boot, not on the first request that happens to touch a session.
    const { assertProductionConfig, productionConfigWarnings } = await import("./config");
    assertProductionConfig();

    // Non-fatal, but not silent either. A production deploy with no mail
    // provider looks healthy and quietly locks out every user who forgets a
    // password, so it is reported at boot and again on the admin status API.
    for (const warning of productionConfigWarnings()) {
      console.warn(`WARNING: RankPilot started with incomplete configuration. ${warning}`);
    }

    const { registerCrawlerJobs } = await import("./crawler/register");
    const { registerScheduleJobs, scheduleTicks } = await import("./crawler/schedules");
    const { startWorker } = await import("./jobs/worker");
    registerCrawlerJobs();
    registerScheduleJobs();
    startWorker();
    if (process.env.RANKPILOT_SCHEDULES !== "off") scheduleTicks();
  } catch (error) {
    // Without this, a failed startup becomes an unhandled rejection: the server
    // still prints "Ready", still binds the port, and answers every request
    // with 500. systemd, Docker, and Kubernetes all treat an open port as
    // healthy, so a boot-time misconfiguration would be reported as a running
    // instance and would sit there failing every request until someone noticed.
    // Exiting non-zero makes the orchestrator see the truth and restart or
    // fail loudly instead of serving errors.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      "FATAL: RankPilot failed to start. Startup checks did not pass, so this " +
        "process cannot serve traffic and will exit rather than answer with 500s.\n" +
        `Cause: ${message}`
    );
    process.exit(1);
  }
}
