// FILE: ~/Documents/EcomProject/lib/cache/category-cache.ts
//
// Redis-backed cache for the category tree.
// The tree rarely changes but is read on every storefront nav render.
// Cache TTL: 5 minutes. Invalidate on any write operation.
//
// USAGE IN REPOSITORY:
//   Replace direct getCategoryTree() calls on the storefront with
//   getCategoryTreeCached() from this file.

import { redis } from "@/lib/db/redis"; // your existing Redis client
import {
  getCategoryTree,
  getActiveCategoryTree,
  type CategoryNode,
} from "@/lib/repositories/category.repository";

const TREE_KEY = "category:tree:full";
const ACTIVE_TREE_KEY = "category:tree:active";
const TTL_SECONDS = 300; // 5 minutes

// ── Read ──────────────────────────────────────────────────────────────────

export async function getCategoryTreeCached(): Promise<CategoryNode[]> {
  try {
    const cached = await redis.get(TREE_KEY);
    if (cached) return JSON.parse(cached) as CategoryNode[];
  } catch {
    // Redis unavailable — fall through to DB
  }

  const tree = await getCategoryTree();

  try {
    await redis.setex(TREE_KEY, TTL_SECONDS, JSON.stringify(tree));
  } catch {
    // Non-fatal: caching failed, result is still correct
  }

  return tree;
}

export async function getActiveCategoryTreeCached(): Promise<CategoryNode[]> {
  try {
    const cached = await redis.get(ACTIVE_TREE_KEY);
    if (cached) return JSON.parse(cached) as CategoryNode[];
  } catch {}

  const tree = await getActiveCategoryTree();

  try {
    await redis.setex(ACTIVE_TREE_KEY, TTL_SECONDS, JSON.stringify(tree));
  } catch {}

  return tree;
}

// ── Invalidation ──────────────────────────────────────────────────────────
//
// Call this in every admin write: createCategory, updateCategory,
// moveCategory, reorderCategories, safeDeleteCategory.
//
// Example — in your admin API route after a write:
//   await invalidateCategoryCache();

export async function invalidateCategoryCache(): Promise<void> {
  try {
    await redis.del(TREE_KEY, ACTIVE_TREE_KEY);
  } catch {
    // Non-fatal
  }
}
