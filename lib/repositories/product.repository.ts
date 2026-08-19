import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export interface ProductFilters {
  categorySlug?: string;
  /**
   * When true (default), the query also returns products from all
   * sub-categories of the matched category (deep search). Set to false
   * to get only direct-category products.
   */
  includeDescendants?: boolean;
  minPrice?: number;
  maxPrice?: number;
  searchQuery?: string;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  status?: "draft" | "active" | "archived";
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  page?: number;
  pageSize?: number;
  /** When true, includes all statuses (admin views) instead of forcing "active". */
  includeAllStatuses?: boolean;
}

function resolveSortOrder(
  sort?: ProductFilters["sort"]
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "name_asc":
      return { name: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

/** Returns category id + all descendant ids via a single DB call. */
async function resolveCategoryIds(
  slug: string,
  includeDescendants: boolean
): Promise<string[]> {
  const root = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!root) return [];
  if (!includeDescendants) return [root.id];

  // Fetch flat list once and walk tree in-memory.
  const allCats = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });

  const ids: string[] = [root.id];
  const queue = [root.id];

  while (queue.length) {
    const current = queue.shift()!;
    for (const cat of allCats) {
      if (cat.parentId === current) {
        ids.push(cat.id);
        queue.push(cat.id);
      }
    }
  }

  return ids;
}

export async function getProducts(filters: ProductFilters = {}) {
  const {
    categorySlug,
    includeDescendants = true,
    minPrice,
    maxPrice,
    searchQuery,
    isFeatured,
    isBestSeller,
    isNewArrival,
    status,
    sort,
    page = 1,
    pageSize = 24,
    includeAllStatuses = false,
  } = filters;

  const where: Prisma.ProductWhereInput = {
    ...(includeAllStatuses ? {} : { status: status ?? "active" }),
    deletedAt: null,
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
        price: {
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        },
      }
      : {}),
    ...(isFeatured !== undefined ? { isFeatured } : {}),
    ...(isBestSeller !== undefined ? { isBestSeller } : {}),
    ...(isNewArrival !== undefined ? { isNewArrival } : {}),
    ...(searchQuery
      ? {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          { tags: { has: searchQuery.toLowerCase() } },
        ],
      }
      : {}),
  };

  // Category filter — resolves slug → ids, optionally expanding the subtree.
  if (categorySlug) {
    const categoryIds = await resolveCategoryIds(categorySlug, includeDescendants);
    if (categoryIds.length === 0) {
      // Slug doesn't exist → return empty result immediately.
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
    where.categoryId = { in: categoryIds };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { displayOrder: "asc" } },
        category: true,
      },
      orderBy: resolveSortOrder(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, deletedAt: null },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      category: true,
      reviews: {
        where: { status: "approved" },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      },
      // FIX: join seller → store so the product page can render
      // "Sold by [Store Name]" and link to /store/[slug].
      // Only present when sellerId is set (system-seller products may
      // have no seller relation depending on backfill state) — the page
      // guards with `product.seller?.store` so this is safe either way.
      seller: {
        select: {
          id: true,
          isSystemSeller: true,
          store: {
            select: {
              name: true,
              slug: true,
              avgRating: true,
              reviewCount: true,
            },
          },
        },
      },
    },
  });
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { images: true, category: true },
  });
}

export async function createProduct(
  data: Prisma.ProductCreateInput
) {
  return prisma.product.create({ data, include: { images: true } });
}

export async function updateProduct(
  id: string,
  data: Prisma.ProductUpdateInput
) {
  return prisma.product.update({ where: { id }, data, include: { images: true } });
}

export async function softDeleteProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), status: "archived" },
  });
}

export async function decrementStock(productId: string, quantity: number) {
  // Use a transaction with an in-query stock check to prevent
  // race conditions under concurrent orders.
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { stockQty: true },
    });

    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    if (product.stockQty < quantity) throw new Error("INSUFFICIENT_STOCK");

    return tx.product.update({
      where: { id: productId },
      data: { stockQty: { decrement: quantity } },
    });
  });
}

export async function slugExists(slug: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({ where: { slug } });
  return existing !== null;
}

export async function skuExists(sku: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({ where: { sku } });
  return existing !== null;
}

export async function duplicateProduct(id: string) {
  const original = await prisma.product.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!original) return null;

  const newSlug = `${original.slug}-copy-${Date.now()}`;
  const newSku = `${original.sku}-COPY-${Date.now()}`;

  return prisma.product.create({
    data: {
      name: `${original.name} (Copy)`,
      slug: newSlug,
      description: original.description,
      shortDescription: original.shortDescription,
      price: original.price,
      comparePrice: original.comparePrice,
      costPrice: original.costPrice,
      categoryId: original.categoryId,
      sku: newSku,
      stockQty: 0,
      lowStockThreshold: original.lowStockThreshold,
      weightGrams: original.weightGrams,
      status: "draft",
      tags: original.tags,
      metaTitle: original.metaTitle,
      metaDescription: original.metaDescription,
      images: {
        create: original.images.map((img) => ({
          url: img.url,
          altText: img.altText,
          displayOrder: img.displayOrder,
          isPrimary: img.isPrimary,
        })),
      },
    },
    include: { images: true },
  });
}

export async function getLowStockProducts() {
  // Prisma's query builder can't compare two columns of the same row
  // directly in a `where` clause, so this uses a raw parameterized query.
  // $queryRaw is safe here since no user input is interpolated.
  return prisma.$queryRaw`
    SELECT * FROM products
    WHERE deleted_at IS NULL
      AND status = 'active'
      AND stock_qty <= low_stock_threshold
    ORDER BY stock_qty ASC
  `;
}