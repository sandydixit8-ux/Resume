import { buildContextPack, contextHash } from "./context";
import { getTask, type TaskName } from "./tasks";
import { runTask, QuotaExceededError, type TaskResult } from "./run";
import { monthlySpend, meterCall, assertReportQuota } from "./meter";
import { route } from "./router";
import { getProvider, setProvider } from "./provider";
import { EPISTEMIC } from "./types";

export interface ExecuteOpts {
  tenantId: string;
  plan: string;
  websiteId?: string;
  pageId?: string;
  contentId?: string;
  brief?: Record<string, unknown>;
  /** Extra render-only data (post, idea, formats...). Never trusted as instructions. */
  render?: Record<string, unknown>;
  social?: boolean;
}

/** One call site for every AI task: context pack → prompt → provider/fallback → metered result. */
export async function executeTask<T>(task: TaskName, opts: ExecuteOpts): Promise<TaskResult<T>> {
  const def = getTask(task);
  const context = buildContextPack({
    tenantId: opts.tenantId,
    websiteId: opts.websiteId,
    pageId: opts.pageId,
    contentId: opts.contentId,
    brief: opts.brief,
  });

  return runTask<T>({
    tenantId: opts.tenantId,
    plan: opts.plan,
    task,
    schema: def.schema as never,
    context,
    renderCtx: { ...opts.render, brief: opts.brief, context },
    fallback: () => def.fallback({ ...context, brief: opts.brief, ...opts.render }) as T,
    social: opts.social,
  });
}

/** Context hash for caching/traceability of a generation. */
export function packHash(tenantId: string, websiteId?: string): string {
  return contextHash(buildContextPack({ tenantId, websiteId }));
}

export {
  buildContextPack,
  contextHash,
  route,
  getProvider,
  setProvider,
  meterCall,
  monthlySpend,
  assertReportQuota,
  QuotaExceededError,
  EPISTEMIC,
};
export type { TaskResult, TaskName };
