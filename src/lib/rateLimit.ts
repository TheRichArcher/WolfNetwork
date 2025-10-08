// Simple in-memory token bucket per user. Replace with Redis in production.
const buckets = new Map<string, { tokens: number; updatedAt: number }>();

export function checkRateLimit(key: string, maxPerMinute = 4): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const refillRate = maxPerMinute / windowMs; // tokens per ms
  const bucket = buckets.get(key) || { tokens: maxPerMinute, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + elapsed * refillRate);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}


