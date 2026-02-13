import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  // Keep reconnect attempts but backoff to avoid noisy tight-loop retries.
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

let lastRedisErrorLogAt = 0;

redis.on("error", (error) => {
  const now = Date.now();
  // Throttle repeated connection errors when Redis is down.
  if (now - lastRedisErrorLogAt < 15000) return;

  lastRedisErrorLogAt = now;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[redis] ${message}`);
});
