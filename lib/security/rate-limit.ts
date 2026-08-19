import { redis } from "@/lib/db/redis";

/**
 * Sliding-window rate limiter backed by Redis.
 * Returns { allowed, remaining, retryAfterSeconds }.
 *
 * Usage: rateLimit(`login:${ip}`, 10, 60) → 10 requests per 60 seconds.
 *
 * PHASE 12 HARDENING: removed the NODE_ENV !== "production" bypass that
 * was present since Phase 1 (returned allowed:true unconditionally outside
 * production). That bypass meant rate limits were never actually exercised
 * in dev or staging — a tested-in-prod antipattern. Rate limits now run
 * in all environments. If you need to test burst behaviour locally without
 * hitting limits, raise the limit values in the specific test call rather
 * than bypassing the whole mechanism.
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const redisKey = `ratelimit:${key}`;

  const current = await redis.incr(redisKey);

  if (current === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  if (current > maxRequests) {
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - current,
    retryAfterSeconds: 0,
  };
}

/** Extracts a best-effort client IP from request headers (works behind Vercel/Cloudflare proxies). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
