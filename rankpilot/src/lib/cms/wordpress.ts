/**
 * WordPress CMS client, implemented against the real WordPress REST API.
 *
 * The CMS auto-fix flow is only honest if a "backup" is a thing that exists. So
 * this client does four concrete operations against a live site:
 *
 *   backup  -> GET  /wp-json/wp/v2/posts/{id}?context=edit   (pre-change content)
 *   apply   -> POST /wp-json/wp/v2/posts/{id}                (write new content)
 *   verify  -> GET  /wp-json/wp/v2/posts/{id}?context=edit   (re-read, compare)
 *   restore -> POST /wp-json/wp/v2/posts/{id}                (write the backup back)
 *
 * Auth is HTTP Basic with a WordPress *application password* (not the account
 * password). Credentials come from the environment and are never persisted; the
 * database only ever holds the pre-change content itself, which is the backup.
 *
 * Nothing here fabricates a result: a non-2xx answer throws with the status, and
 * `verify` reports drift instead of self-declaring success.
 */

const API = "/wp-json/wp/v2";

export interface WordpressConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
}

/**
 * Build the active config, or a human reason why WordPress writes are off.
 * Fails closed: no application password, no CMS writes.
 */
export function wordpressConfig(
  env: Record<string, string | undefined> = process.env
): { config: WordpressConfig } | { problem: string } {
  const rawBase = env.WORDPRESS_BASE_URL?.trim();
  const username = env.WORDPRESS_USERNAME?.trim();
  const appPassword = env.WORDPRESS_APP_PASSWORD?.trim();
  if (!rawBase || !username || !appPassword) {
    return {
      problem:
        "WORDPRESS_BASE_URL, WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD are not all set, so no CMS write is attempted",
    };
  }
  let baseUrl: string;
  try {
    baseUrl = new URL(rawBase).origin;
  } catch {
    return { problem: "WORDPRESS_BASE_URL is not a valid URL" };
  }
  // WordPress application passwords are only accepted over TLS. Refusing HTTP
  // here is what stops a plaintext credential from ever leaving the process.
  if (!baseUrl.startsWith("https://")) {
    return { problem: "WORDPRESS_BASE_URL must use https — WordPress rejects application passwords over plain HTTP" };
  }
  return { config: { baseUrl, username, appPassword } };
}

/** The pre-change state we store as the backup, and can restore from. */
export interface PostSnapshot {
  id: number;
  title: string;
  content: string;
  status: string;
  modifiedGmt: string;
}

interface WpPost {
  id: number;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  status?: string;
  modified_gmt?: string;
}

function authHeader(config: WordpressConfig): string {
  const token = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");
  return `Basic ${token}`;
}

function url(config: WordpressConfig, path: string, query: string): string {
  return `${config.baseUrl}${API}${path}?${query}`;
}

/** The fields a fix may change. A fix that asks for anything else is rejected. */
export interface FixPayload {
  postId: number;
  content: string;
  title?: string;
}

/** Narrow an untyped payload to a usable fix, or return why it is not one. */
export function parseFixPayload(payload: unknown): { payload: FixPayload } | { problem: string } {
  if (typeof payload !== "object" || payload === null) return { problem: "payload must be an object" };
  const p = payload as Record<string, unknown>;
  // Strict on purpose: a numeric string is a caller bug, and coercing it would
  // mean a fix could name a post nobody verified.
  if (typeof p.postId !== "number" || !Number.isInteger(p.postId) || p.postId <= 0) {
    return { problem: "payload.postId must be a positive integer WordPress post id" };
  }
  if (typeof p.content !== "string" || p.content.length === 0) {
    return { problem: "payload.content must be a non-empty string" };
  }
  if (p.title !== undefined && typeof p.title !== "string") {
    return { problem: "payload.title must be a string when present" };
  }
  return {
    payload: {
      postId: p.postId,
      content: p.content,
      ...(typeof p.title === "string" ? { title: p.title } : {}),
    },
  };
}

async function wpFetch(config: WordpressConfig, path: string, query: string, init?: RequestInit & { fetchFn?: typeof fetch }) {
  const f = init?.fetchFn ?? fetch;
  const { fetchFn: _ignored, ...rest } = init ?? {};
  void _ignored;
  const res = await f(url(config, path, query), {
    ...rest,
    headers: {
      authorization: authHeader(config),
      accept: "application/json",
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    redirect: "error",
  });
  if (!res.ok) {
    throw new Error(`WordPress returned ${res.status} for ${path}`);
  }
  return res;
}

/** Read the current post. This is the backup: whatever it returns is what a
 *  restore would put back. */
export async function backupPost(
  config: WordpressConfig,
  postId: number,
  fetchFn: typeof fetch = fetch
): Promise<PostSnapshot> {
  const res = await wpFetch(config, `/posts/${postId}`, "context=edit", { fetchFn });
  const post = (await res.json()) as WpPost;
  return {
    id: post.id,
    title: post.title?.raw ?? post.title?.rendered ?? "",
    content: post.content?.raw ?? post.content?.rendered ?? "",
    status: post.status ?? "unknown",
    modifiedGmt: post.modified_gmt ?? "",
  };
}

/** Write the fix. Returns the post as WordPress reports it after the write. */
export async function applyPost(
  config: WordpressConfig,
  fix: FixPayload,
  fetchFn: typeof fetch = fetch
): Promise<PostSnapshot> {
  const body = JSON.stringify({
    content: fix.content,
    ...(fix.title !== undefined ? { title: fix.title } : {}),
  });
  const res = await wpFetch(config, `/posts/${fix.postId}`, "context=edit", {
    method: "POST",
    body,
    fetchFn,
  });
  const post = (await res.json()) as WpPost;
  return {
    id: post.id,
    title: post.title?.raw ?? post.title?.rendered ?? fix.title ?? "",
    content: post.content?.raw ?? post.content?.rendered ?? "",
    status: post.status ?? "unknown",
    modifiedGmt: post.modified_gmt ?? "",
  };
}

/**
 * Re-read the post and compare against what we intended. Returns a verdict
 * rather than a boolean so the route can say *how* it drifted.
 */
export async function verifyPost(
  config: WordpressConfig,
  expected: FixPayload,
  fetchFn: typeof fetch = fetch
): Promise<{ verified: boolean; reason?: string; snapshot: PostSnapshot }> {
  const snapshot = await backupPost(config, expected.postId, fetchFn);
  const expectedTitle = expected.title ?? null;
  if (snapshot.content !== expected.content) {
    return { verified: false, reason: "content_drift", snapshot };
  }
  if (expectedTitle !== null && snapshot.title !== expectedTitle) {
    return { verified: false, reason: "title_drift", snapshot };
  }
  return { verified: true, snapshot };
}

/** Put a backup back. Used by the discard-after-apply path. */
export async function restorePost(
  config: WordpressConfig,
  backup: PostSnapshot,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  await wpFetch(config, `/posts/${backup.id}`, "context=edit", {
    method: "POST",
    body: JSON.stringify({ content: backup.content, title: backup.title }),
    fetchFn,
  });
}
