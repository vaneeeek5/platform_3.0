import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Using a lazy connection to avoid blocking the main thread if Redis is down
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: 5000, // 5 seconds timeout
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("error", (err) => {
  // We log but don't crash. BullMQ will handle retries or errors when jobs are added.
  console.warn("Redis Connection Error (will retry):", err.message);
});
