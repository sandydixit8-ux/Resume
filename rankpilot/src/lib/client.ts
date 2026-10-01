"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
      headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      ...init,
    });
    const body = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!body || typeof body !== "object" || !("ok" in body)) {
      return { ok: false, error: { code: "server_error", message: "Unexpected response." } };
    }
    return body;
  } catch {
    return { ok: false, error: { code: "network", message: "Network error. Please try again." } };
  }
}
