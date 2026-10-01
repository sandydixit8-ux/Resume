const MAX_KEYS = 10_000;
/** Evict down to this fraction of MAX_KEYS so pruning is not on every request. */
const LOW_WATER = 0.9;

interface Bucket {
  hits: number[];
  /** The window this bucket was created with. Used for its own expiry. */
  windowMs: number;
  lastSeen: number;
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Sliding-window rate limiter (in-memory, per-process).
 *
 * Two properties this must hold, both of which were previously broken:
 *
 *  1. A bucket expires against *its own* window. Expiring a 15-minute bucket
 *     against an unrelated 1-minute caller's window would silently reset it --
 *     an attacker could reset their login bucket just by generating short-window
 *     traffic. A longer window always wins, so a bucket can never be shortened.
 *  2. The keyspace is strictly bounded. `MAX_KEYS` used to be checked but
 *     never enforced: if nothing looked expired the map just kept growing, and
 *     rotating identifiers (IPs, emails) is exactly how you would grow it. Old
 *     buckets are now dropped until the map is back under the cap.
 *
 * In-memory and per-process by design: single-node deployment is an accepted
 * constraint. Horizontally scaled deployments must move this to a shared store
 * (see docs/11) or every node enforces its own independent limit.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();

  if (buckets.size >= MAX_KEYS) evict(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], windowMs, lastSeen: now };
    buckets.set(key, bucket);
  } else if (windowMs > bucket.windowMs) {
    // Never let a shorter window shorten an existing bucket's window.
    bucket.windowMs = windowMs;
  }

  const cutoff = now - bucket.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  bucket.lastSeen = now;

  if (bucket.hits.length >= limit) {
    const retryAfterMs = bucket.hits[0] + bucket.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.hits.push(now);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

/** Drops expired buckets, then force-drops the oldest until under the cap. */
function evict(now: number): void {
  for (const [k, v] of buckets) {
    if (v.hits.length === 0 || v.hits[v.hits.length - 1] <= now - v.windowMs) buckets.delete(k);
  }
  if (buckets.size < MAX_KEYS) return;

  // Nothing was expired, so the keyspace is being attacked or is simply large.
  // Map preserves insertion order, so the first keys are the oldest.
  const target = Math.floor(MAX_KEYS * LOW_WATER);
  for (const k of [...buckets.keys()]) {
    if (buckets.size <= target) break;
    buckets.delete(k);
  }
}

export interface RateLimitStats {
  trackedKeys: number;
  maxKeys: number;
  totalBlocked: number;
}

/** Counters for the admin status endpoint. */
const counters = { blocked: 0 };

export function noteRateLimited(): void {
  counters.blocked++;
}

export function rateLimitStats(): RateLimitStats {
  return { trackedKeys: buckets.size, maxKeys: MAX_KEYS, totalBlocked: counters.blocked };
}

export function clearRateLimits(): void {
  buckets.clear();
  counters.blocked = 0;
}
