import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

redis.on("error", (err) => {
  // Prevent unhandled error event exceptions when Redis is unavailable/unreachable
  if (process.env.NODE_ENV !== "production") {
    console.warn("Redis connection error:", err.message);
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
