type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneAt = 0;

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (now - lastPruneAt >= PRUNE_INTERVAL_MS) {
    pruneExpiredBuckets(now);
    lastPruneAt = now;
  }

  if (buckets.size >= MAX_BUCKETS) {
    pruneExpiredBuckets(now);
    if (buckets.size >= MAX_BUCKETS) {
      return { allowed: false, retryAfterMs: windowMs };
    }
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= max) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
