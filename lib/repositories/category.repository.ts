import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  level: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
  children: CategoryNode[];
}

import { Prisma } from "@prisma/client";
type BreadcrumbCat = {
  id: string;
  name: string;
  slug: string;
  level: number;
  parentId: string | null;
};
export type CategoryBreadcrumb = Prisma.CategoryGetPayload<{
  select: {
    id: true;
    name: true;
    slug: true;
    level: true;
    parentId: true;
  };
}>;

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetches ALL categories in one DB hit and builds the full tree in-memory.
 * For thousands of categories this is far faster than recursive SQL because
 * it avoids N+1 queries. The full result set is typically < 1MB even at
 * 10,000 categories and can be cached in Redis (see product-cache.ts).
 */
async function fetchAllCategories() {
  return prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
}

function buildTree(
  flat: Awaited<ReturnType<typeof fetchAllCategories>>,
  parentId: string | null = null
): CategoryNode[] {
  return flat
    .filter((c) => c.parentId === parentId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      parentId: c.parentId,
      level: c.level,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      productCount: c._count.products,
      children: buildTree(flat, c.id),
    }));
}

/** Collects all descendant ids of a category (for subtree operations). */
function collectDescendantIds(
  flat: Awaited<ReturnType<typeof fetchAllCategories>>,
  rootId: string
): string[] {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    const children = flat.filter((c) => c.parentId === current);
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────────────────────

/** Full nested tree — use for admin tree view and nav menus. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const flat = await fetchAllCategories();
  return buildTree(flat);
}

/** Active categories only — use for storefront nav. */
export async function getActiveCategoryTree(): Promise<CategoryNode[]> {
  const flat = (await fetchAllCategories()).filter((c) => c.isActive);
  return buildTree(flat);
}

/** Flat list for dropdowns (sorted by level then name). */
export async function getActiveCategories() {
  try {
    return await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    });
  } catch (error) {
    console.error("Failed to fetch active categories:", error);
    return [];
  }
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: { orderBy: { displayOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });
}

/**
 * Returns the ancestor chain from root → category, e.g.:
 * [Electronics, Computers, Laptops]
 * Used for breadcrumbs and SEO path generation.
 */
export async function getCategoryBreadcrumb(
  categoryId: string
): Promise<CategoryBreadcrumb[]> {
  const crumbs: CategoryBreadcrumb[] = [];
  let currentId: string | null = categoryId;

  // Walk up the tree — depth is bounded by the number of actual levels
  // (typically < 10 even for the deepest hierarchies).
  while (currentId) {
    const cat: BreadcrumbCat | null = await prisma.category.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        name: true,
        slug: true,
        level: true,
        parentId: true,
      },
    });

    if (!cat) break;

    crumbs.unshift({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      level: cat.level,
      parentId: cat.parentId,
    });

    currentId = cat.parentId;
  }

  return crumbs;
}

/**
 * Generates a SEO-friendly URL path for a category, e.g.:
 * "electronics/computers/laptops"
 * Used for <meta canonical> and link generation.
 */
export async function getCategoryPath(categoryId: string): Promise<string> {
  const crumbs = await getCategoryBreadcrumb(categoryId);
  return crumbs.map((c) => c.slug).join("/");
}

export async function categorySlugExists(slug: string): Promise<boolean> {
  const cat = await prisma.category.findUnique({ where: { slug } });
  return !!cat;
}

// ─────────────────────────────────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────────────────────────────────

export async function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}) {
  // Level = parent's level + 1, or 0 for root categories.
  let level = 0;
  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
      select: { level: true },
    });
    if (!parent) throw new AppError("VALIDATION_ERROR", { parentId: "Parent category not found." });
    level = parent.level + 1;
  }

  return prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      imageUrl: data.imageUrl,
      parentId: data.parentId ?? null,
      level,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    imageUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }
) {
  return prisma.category.update({ where: { id }, data });
}

/**
 * Moves a category to a new parent (or to root if newParentId is null).
 * Recalculates level for the entire subtree transactionally.
 *
 * Safety check: prevents circular references (can't move a category
 * into one of its own descendants).
 */
export async function moveCategory(
  id: string,
  newParentId: string | null
): Promise<void> {
  const flat = await fetchAllCategories();

  // Circular reference guard: newParentId must not be a descendant of id.
  if (newParentId) {
    const descendants = collectDescendantIds(flat, id);
    if (descendants.includes(newParentId) || newParentId === id) {
      throw new AppError("VALIDATION_ERROR", {
        parentId: "Cannot move a category into one of its own descendants.",
      });
    }
  }

  // Calculate new level for the moved category.
  let newLevel = 0;
  if (newParentId) {
    const newParent = flat.find((c) => c.id === newParentId);
    if (!newParent) throw new AppError("VALIDATION_ERROR", { parentId: "Parent not found." });
    newLevel = newParent.level + 1;
  }

  // Transactionally update the moved category and fix all its descendants.
  const levelDiff = newLevel - (flat.find((c) => c.id === id)?.level ?? 0);
  const descendants = collectDescendantIds(flat, id);

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: { parentId: newParentId, level: newLevel },
    });

    // Fix all descendant levels in bulk.
    for (const descId of descendants) {
      const current = flat.find((c) => c.id === descId)!;
      await tx.category.update({
        where: { id: descId },
        data: { level: current.level + levelDiff },
      });
    }
  });
}

/**
 * Reorders siblings by accepting an ordered array of category ids.
 * Sets displayOrder = index for each id in the array.
 */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.category.update({
        where: { id },
        data: { displayOrder: index },
      })
    )
  );
}

/**
 * Safely deletes a category.
 * Blocks deletion if the category has products or children.
 * Pass force=true to delete even if it has children (recursively deletes
 * the entire subtree — use with caution, only if products are reassigned).
 */
export async function safeDeleteCategory(
  id: string,
  force = false
): Promise<void> {
  const cat = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true, children: true } },
    },
  });

  if (!cat) throw new AppError("VALIDATION_ERROR", { id: "Category not found." });

  if (cat._count.products > 0) {
    throw new AppError("VALIDATION_ERROR", {
      id: `Cannot delete "${cat.name}" — it has ${cat._count.products} product(s). Reassign or delete the products first.`,
    });
  }

  if (!force && cat._count.children > 0) {
    throw new AppError("VALIDATION_ERROR", {
      id: `Cannot delete "${cat.name}" — it has ${cat._count.children} subcategorie(s). Delete or move them first.`,
    });
  }

  if (force && cat._count.children > 0) {
    // Recursively delete children first (they must also have no products).
    const children = await prisma.category.findMany({ where: { parentId: id } });
    for (const child of children) {
      await safeDeleteCategory(child.id, true);
    }
  }

  await prisma.category.delete({ where: { id } });
}