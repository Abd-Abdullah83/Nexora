import { redis } from "@/lib/db/redis";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Generic cache-aside helper: try Redis first, fall back to the provided
 * loader function on a miss, then populate the cache for next time.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) {
      return JSON.parse(hit) as T;
    }
  } catch {
    // Redis being unavailable should never break the request — fall through
    // to the loader and serve uncached data instead.
  }

  const fresh = await loader();

  try {
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  } catch {
    // Same here — a failed cache write is not a failed request.
  }

  return fresh;
}

export async function invalidateCache(keyOrPrefix: string): Promise<void> {
  try {
    if (keyOrPrefix.endsWith("*")) {
      const keys = await redis.keys(keyOrPrefix);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.del(keyOrPrefix);
    }
  } catch {
    // Non-fatal — cache will simply remain stale until natural expiry.
  }
}

export const CacheKeys = {
  categories: "cache:categories:active",
  productsList: (filtersHash: string) => `cache:products:list:${filtersHash}`,
  productDetail: (slug: string) => `cache:products:detail:${slug}`,
  productsAll: "cache:products:*",
};
