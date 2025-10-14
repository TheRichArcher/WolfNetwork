import { getRedis } from './redis';

export async function checkRateLimit(key: string, maxPerMinute = 4): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    // Fallback to in-memory if Redis is not configured.
    // This maintains functionality in local/dev environments without Redis.
    return checkRateLimitInMemory(key, maxPerMinute);
  }

  const windowMs = 60_000;
  const now = Date.now();
  const keyWithMinute = `${key}:${Math.floor(now / windowMs)}`;

  try {
    const results = await redis.multi().incr(keyWithMinute).expire(keyWithMinute, 60).exec();

    if (!results) {
      console.error('Redis transaction failed in rate limiter.');
      return checkRateLimitInMemory(key, maxPerMinute);
    }

    const [incrError, count] = results[0];
    const [expireError] = results[1];

    if (incrError || expireError) {
      console.error('Redis command failed in rate limiter:', incrError || expireError);
      return checkRateLimitInMemory(key, maxPerMinute);
    }

    if (typeof count === 'number' && count > maxPerMinute) {
      return false;
    }
  } catch (error) {
    console.error('Redis error in rate limiter:', error);
    // If Redis fails, fallback to in-memory to avoid blocking requests.
    return checkRateLimitInMemory(key, maxPerMinute);
  }

  return true;
}

// Keep the original in-memory implementation as a fallback.
const buckets = new Map<string, { tokens: number; updatedAt: number }>();
function checkRateLimitInMemory(key: string, maxPerMinute = 4): boolean {
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


