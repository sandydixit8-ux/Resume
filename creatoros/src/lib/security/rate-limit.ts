type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

/**
 * In-memory sliding-window-ish rate limiter keyed by route+ip.
 * Suitable for single-instance deployments; swap for Redis in production.
 */
export function rateLimit(key: string, max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function rateKey(route: string, ip: string): string {
  return `${route}:${ip}`;
}

// Clear expired buckets periodically to avoid unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}, 60_000).unref();