import { registerHandler, registerReaper } from "@/lib/jobs/worker";
import { executeCrawl, releaseLostCrawlRun } from "./run";

let registered = false;

export function registerCrawlerJobs(): void {
  if (registered) return;
  registered = true;
  registerHandler("crawl.run", async (payload) => {
    const runId = String(payload.runId ?? "");
    if (!runId) throw new Error("missing runId");
    const maxPages = typeof payload.maxPages === "number" ? payload.maxPages : null;
    await executeCrawl(runId, { maxPages });
  });
  // The queue cannot know that a crawl also owns a `crawl_runs` row, so the
  // crawl registers how to release it when its worker is lost.
  registerReaper("crawl.run", (job) => {
    let runId = "";
    try {
      const payload = JSON.parse(job.payload) as { runId?: unknown };
      runId = typeof payload.runId === "string" ? payload.runId : "";
    } catch {
      return;
    }
    if (!runId) return;
    releaseLostCrawlRun(runId, job.outcome, job.reason);
  });
}
