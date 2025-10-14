import Redis from 'ioredis';
import { getEnv } from './env';

const env = getEnv();
let redis: Redis | null = null;

export function getRedis() {
  if (!redis && env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
      // Lazy connect to avoid issues in environments where Redis isn't available
      lazyConnect: true,
      // Keep retrying to connect
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}
