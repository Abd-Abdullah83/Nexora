// lib/sellers/promotions.service.ts
//
// Phase 10 — Seller-created promotions (scoped to their own listings).
//
// ── Design note: why not reuse the Coupon model? ─────────────────────────
// SellerPromotion is a separate table from platform Coupons for a clean
// reason: Coupons are platform-admin-created, have no seller ownership,
// and are applied at the order level. Seller promotions are seller-created,
// scoped to a specific seller's listings, and checked alongside (not
// instead of) platform coupons. Merging them would require nullable
// sellerId on Coupon plus special-casing across all coupon validation
// logic. Checkout route checks BOTH sources in sequence; the first
// matching code wins (seller code checked first, platform code second).
//
// ── Code uniqueness: global, not per-seller ──────────────────────────────
// The unique constraint on SellerPromotion.code is GLOBAL — two sellers
// can't create the same code. This is intentional: at checkout, when a
// buyer types "SUMMER20", we don't yet know which seller's products are
// in scope. A global constraint means we can do a single lookup and the
// result is unambiguous.

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit";

export async function createPromotion(
  sellerId: string,
  actorUserId: string,
  data: {
    code: string;
    description?: string;
    promotionType: "percentage" | "fixed_amount";
    discountValue: number;
    productId?: string | null;
    minOrderAmount?: number | null;
    maxUses?: number | null;
    expiresAt?: Date | null;
  }
) {
  // If scoped to a product, verify it belongs to this seller
  if (data.productId) {
    const product = await prisma.product.findFirst({
      where: { id: data.productId, sellerId },
      select: { id: true },
    });
    if (!product) {
      throw new AppError("VALIDATION_ERROR", {
        productId: "This product does not belong to your store.",
      });
    }
  }

  // Code uniqueness — global, see design note above
  const existing = await prisma.sellerPromotion.findUnique({
    where: { code: data.code.toUpperCase() },
  });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", {
      code: "This promotion code is already in use. Please choose a different one.",
    });
  }

  const promotion = await prisma.sellerPromotion.create({
    data: {
      sellerId,
      code: data.code.toUpperCase(),
      description: data.description,
      promotionType: data.promotionType,
      discountValue: data.discountValue,
      productId: data.productId ?? null,
      minOrderAmount: data.minOrderAmount ?? null,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt ?? null,
    },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.promotion_created",
    resourceType: "seller_promotion",
    resourceId: promotion.id,
    ipAddress: "internal",
    newValues: { code: promotion.code, type: promotion.promotionType },
  });

  return promotion;
}

export async function listSellerPromotions(sellerId: string) {
  return prisma.sellerPromotion.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function deactivatePromotion(
  promotionId: string,
  sellerId: string,
  actorUserId: string
) {
  const promotion = await prisma.sellerPromotion.findFirst({
    where: { id: promotionId, sellerId },
  });
  if (!promotion) {
    throw new AppError("VALIDATION_ERROR", { id: "Promotion not found." });
  }

  const updated = await prisma.sellerPromotion.update({
    where: { id: promotionId },
    data: { isActive: false },
  });

  await logAuditEvent({
    userId: actorUserId,
    action: "seller.promotion_deactivated",
    resourceType: "seller_promotion",
    resourceId: promotionId,
    ipAddress: "internal",
  });

  return updated;
}

/**
 * Validates a seller promotion code at checkout.
 * Returns the promotion and computed discountAmount if valid.
 * Returns null (not an error) if the code doesn't match any seller
 * promotion — the checkout route then falls through to check platform
 * coupons.
 */
export async function validateSellerPromotion(params: {
  code: string;
  subtotal: number;
  productIds?: string[]; // product IDs in the cart — for scoped promotions
}) {
  const promotion = await prisma.sellerPromotion.findUnique({
    where: { code: params.code.toUpperCase() },
  });

  if (!promotion || !promotion.isActive) return null;
  if (promotion.expiresAt && promotion.expiresAt < new Date()) return null;
  if (promotion.maxUses !== null && promotion.usedCount >= promotion.maxUses) return null;
  if (
    promotion.minOrderAmount &&
    params.subtotal < Number(promotion.minOrderAmount)
  )
    return null;

  // If scoped to a product, at least one of those products must be in cart
  if (promotion.productId && params.productIds) {
    if (!params.productIds.includes(promotion.productId)) return null;
  }

  const discountAmount =
    promotion.promotionType === "percentage"
      ? (params.subtotal * Number(promotion.discountValue)) / 100
      : Math.min(Number(promotion.discountValue), params.subtotal);

  return {
    id: promotion.id,
    code: promotion.code,
    sellerId: promotion.sellerId,
    description: promotion.description,
    promotionType: promotion.promotionType,
    discountValue: Number(promotion.discountValue),
    discountAmount: Number(discountAmount.toFixed(2)),
    isSellerPromotion: true as const,
  };
}

/** Increments usedCount when an order using this promotion is placed. */
export async function incrementPromotionUsage(promotionId: string) {
  await prisma.sellerPromotion.update({
    where: { id: promotionId },
    data: { usedCount: { increment: 1 } },
  });
}
