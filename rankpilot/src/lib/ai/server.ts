import { NextResponse } from "next/server";
import { executeTask, QuotaExceededError, type TaskName, type TaskResult } from "@/lib/ai";
import { err } from "@/lib/http";
import { getSession, type SessionResult } from "@/lib/auth/get-session";
import { can, type Permission } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/security/rate-limit";

export interface AiCallOpts {
  websiteId?: string;
  pageId?: string;
  contentId?: string;
  brief?: Record<string, unknown>;
  render?: Record<string, unknown>;
  social?: boolean;
}

/** Auth + permission + AI call in one place; maps quota errors to HTTP 402. */
export async function aiCall<T>(
  task: TaskName,
  opts: AiCallOpts,
  permission: Permission = "content:write"
): Promise<{ s: SessionResult; result: TaskResult<T> } | NextResponse> {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, permission)) return err.forbidden();

  const rl = rateLimit(`ai:${s.org.id}`, 30, 60_000);
  if (!rl.allowed) return err.rateLimited("AI request limit reached. Please slow down.");

  try {
    const result = await executeTask<T>(task, {
      tenantId: s.org.id,
      plan: s.org.plan,
      websiteId: opts.websiteId,
      pageId: opts.pageId,
      contentId: opts.contentId,
      brief: opts.brief,
      render: opts.render,
      social: opts.social,
    });
    return { s, result };
  } catch (e) {
    if (e instanceof QuotaExceededError) return err.quota(e.message);
    throw e;
  }
}

export function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
