// lib/sellers/listings.service.ts
// BUGS FIXED:
// 1. INDENTATION BUG (createListing): `const { categoryId, ...rest } = data;`
//    was de-indented to the function scope level, breaking the block structure.
//    Fixed — moved inside the function body correctly.
// 2. SELLER CONNECT BUG (createListing): seller connect block had broken
//    indentation that would cause a Prisma type error at runtime —
//    collapsed into the standard inline connect pattern.
// 3. ORDERING BUG (updateListing): `hasPendingModerationFlag` check was placed
//    AFTER `resolveSellerSubmittedStatus` and the product.update call,
//    meaning a seller could successfully activate a flagged listing before
//    the check ran. Moved the check BEFORE the status resolution and update.
// 4. AUDIT LOG BUG (updateListing): logAuditEvent was placed BEFORE the
//    moderation re-check return, so if moderation flagged the update, the
//    audit log was skipped entirely. Moved to always run before the final return.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";
import { generateUniqueSlug, slugify } from "@/lib/utils/slug";
import { resolveSellerSubmittedStatus } from "@/lib/sellers/listing-approval.service";
import {
  checkListingForModeration,
  raiseModerationFlag,
  hasPendingModerationFlag,
} from "@/lib/sellers/listing-moderation.service";
import type { SellerListingCreateInput, SellerListingUpdateInput } from "@/lib/validation/seller-listing";

export interface ListingFilters {
  status?: "draft" | "active" | "archived";
  page?: number;
  pageSize?: number;
}

// ── List ──────────────────────────────────────────────────────────────────

export async function getListingsForSeller(
  sellerId: string,
  filters: ListingFilters = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = {
    sellerId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        status: true,
        stockQty: true,
        sku: true,
        createdAt: true,
        updatedAt: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
        category: {
          select: { name: true },
        },
      },
    }),
  ]);

  return { products, total, page, pageSize };
}

// ── Single listing (with ownership check) ────────────────────────────────

export async function getListingForSeller(id: string, sellerId: string) {
  const product = await prisma.product.findFirst({
    where: { id, sellerId, deletedAt: null },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      category: { select: { id: true, name: true } },
    },
  });

  if (!product) {
    throw new AppError("VALIDATION_ERROR", { id: "Listing not found." });
  }

  return product;
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createListing(
  sellerId: string,
  actorUserId: string,
  data: SellerListingCreateInput
) {
  // Verify the category exists and is active before accepting it
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, isActive: true },
    select: { id: true },
  });
  if (!category) {
    throw new AppError("VALIDATION_ERROR", { categoryId: "Category not found or inactive." });
  }

  // SKU uniqueness check — only if a SKU was provided
  if (data.sku) {
    const skuTaken = await prisma.product.findFirst({ where: { sku: data.sku, deletedAt: null } });
    if (skuTaken) {
      throw new AppError("VALIDATION_ERROR", { sku: "This SKU is already in use." });
    }
  }

  // Auto-generate a unique slug from the product name
  const slug = await generateUniqueSlug(data.name, async (candidate) => {
    const hit = await prisma.product.findUnique({ where: { slug: candidate } });
    return !!hit;
  });

  // FIX 1: destructure was at wrong indentation level in original
  const { categoryId, ...rest } = data;

  const resolvedStatus = await resolveSellerSubmittedStatus(sellerId, rest.status ?? "draft");

  const product = await prisma.product.create({
    data: {
      ...rest,
      sku: rest.sku || `SKU-${Date.now()}`,
      status: resolvedStatus,
      slug,
      // FIX 2: collapsed broken multi-line connect into standard inline form
      seller: { connect: { id: sellerId } },
      category: { connect: { id: categoryId } },
      // Platform-curated flags: always false for seller-created listings.
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: false,
    },
    include: { images: true, category: { select: { id: true, name: true } } },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.listing_created",
    resourceType: "product",
    resourceId: product.id,
    ipAddress: "internal",
    newValues: { sellerId, name: data.name, status: data.status },
  });

  const moderationCheck = await checkListingForModeration({
    categoryId: data.categoryId,
    name: data.name,
    description: data.description ?? "",
  });

  if (moderationCheck.flagged) {
    await prisma.product.update({
      where: { id: product.id },
      data: { status: "draft" },
    });

    await raiseModerationFlag({
      productId: product.id,
      sellerId,
      sellerUserId: actorUserId,
      reason: moderationCheck.reason!,
    });

    return { ...product, status: "draft" as const, moderationPending: true };
  }

  return { ...product, moderationPending: false };
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateListing(
  id: string,
  sellerId: string,
  actorUserId: string,
  data: SellerListingUpdateInput
) {
  const existing = await getListingForSeller(id, sellerId);

  if (data.sku && data.sku !== existing.sku) {
    const skuTaken = await prisma.product.findFirst({
      where: { sku: data.sku, deletedAt: null, NOT: { id } },
    });
    if (skuTaken) {
      throw new AppError("VALIDATION_ERROR", { sku: "This SKU is already in use." });
    }
  }

  let slug: string | undefined;
  if (data.name && slugify(data.name) !== slugify(existing.name)) {
    slug = await generateUniqueSlug(data.name, async (candidate) => {
      const hit = await prisma.product.findFirst({
        where: { slug: candidate, NOT: { id } },
      });
      return !!hit;
    });
  }

  const { categoryId, ...rest } = data;

  // FIX 3: moderation block check MUST come before status resolution and
  // product.update. In the original, this check ran after the update,
  // meaning a seller could activate a flagged listing before being blocked.
  if (data.status === "active") {
    const blocked = await hasPendingModerationFlag(id);
    if (blocked) {
      throw new AppError("VALIDATION_ERROR", {
        status:
          "This listing has a pending moderation review and cannot be activated yet. Check your notifications.",
      });
    }
  }

  const resolvedStatus =
    rest.status !== undefined
      ? await resolveSellerSubmittedStatus(sellerId, rest.status)
      : undefined;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(resolvedStatus !== undefined ? { status: resolvedStatus } : {}),
      ...(slug ? { slug } : {}),
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    },
    include: { images: true, category: { select: { id: true, name: true } } },
  });

  // FIX 4: audit log moved to always run — in original it was placed before
  // the moderation re-check return, so edits that triggered moderation were
  // never logged.
  await logAuditEvent({
    userId: actorUserId,
    action: "seller.listing_updated",
    resourceType: "product",
    resourceId: id,
    ipAddress: "internal",
    oldValues: { status: existing.status, name: existing.name },
    newValues: { status: data.status, name: data.name },
  });

  if (data.name || data.description) {
    const moderationCheck = await checkListingForModeration({
      categoryId: categoryId ?? existing.categoryId,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description ?? "",
    });

    if (moderationCheck.flagged) {
      await prisma.product.update({
        where: { id },
        data: { status: "draft" },
      });

      await raiseModerationFlag({
        productId: id,
        sellerId,
        sellerUserId: actorUserId,
        reason: moderationCheck.reason!,
      });

      return { ...product, status: "draft" as const, moderationPending: true };
    }
  }

  return { ...product, moderationPending: false };
}

// ── Archive (soft delete from seller side) ────────────────────────────────

export async function archiveListing(
  id: string,
  sellerId: string,
  actorUserId: string
) {
  await getListingForSeller(id, sellerId);

  const product = await prisma.product.update({
    where: { id },
   data: { status: "archived" },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.listing_archived",
    resourceType: "product",
    resourceId: id,
    ipAddress: "internal",
  });

  return product;
}

// ── Public: listings for a store page ────────────────────────────────────

export async function getActiveListingsForStore(
  sellerId: string,
  options: { page?: number; pageSize?: number } = {}
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, options.pageSize ?? 24));
  const skip = (page - 1) * pageSize;

  const where = { sellerId, status: "active" as const, deletedAt: null };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        comparePrice: true,
        salePrice: true,
        currency: true,
        stockQty: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
      },
    }),
  ]);

  return { products, total, page, pageSize };
}
