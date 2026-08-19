// app/api/checkout/coupon/route.ts
//
// PHASE 10 PATCH — wires seller promotions into coupon validation.
// The route now checks seller promotions FIRST (they're seller-created,
// more specific), then falls through to platform-wide coupons if no
// seller promotion matched. This is the ONLY change from Phase 1–9's
// version — the platform coupon logic below is byte-for-byte identical.
//
// Why check seller promotions first:
//   - A seller and the platform admin could theoretically both create a
//     code that happens to be the same string. The unique constraint on
//     SellerPromotion.code is GLOBAL (see promotions.service.ts design
//     note), so this CAN'T happen in practice — but if it ever did due to
//     a DB migration error, the seller's own code would take precedence,
//     which is the safer default (the seller typed their own code, they
//     know what they expect).
//   - Seller promotions return an `isSellerPromotion: true` flag so the
//     checkout page can display "Seller discount" vs "Platform coupon" in
//     the UI and so the order-creation route knows to increment
//     SellerPromotion.usedCount instead of Coupon.usedCount.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { validateSellerPromotion } from "@/lib/sellers/promotions.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1).max(50),
  subtotal: z.number().positive(),
  productIds: z.array(z.string()).optional(), // cart product IDs, for scoped promotions
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { code, subtotal, productIds } = parsed.data;

    // ── 1. Check seller promotions first ────────────────────────────────
    const sellerPromotion = await validateSellerPromotion({ code, subtotal, productIds });
    if (sellerPromotion) {
      return Response.json({
        valid: true,
        coupon: {
          id: sellerPromotion.id,
          code: sellerPromotion.code,
          description: sellerPromotion.description,
          discountType: sellerPromotion.promotionType,
          discountValue: sellerPromotion.discountValue,
          discountAmount: sellerPromotion.discountAmount,
          isSellerPromotion: true,
          sellerId: sellerPromotion.sellerId,
        },
      });
    }

    // ── 2. Fall through to platform coupons (unchanged from pre-Phase 10) ─
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      return Response.json({ valid: false, error: "Invalid or inactive coupon code." });
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return Response.json({ valid: false, error: "This coupon has expired." });
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return Response.json({ valid: false, error: "This coupon has reached its usage limit." });
    }
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      return Response.json({
        valid: false,
        error: `Minimum order of PKR ${Number(coupon.minOrderAmount).toFixed(2)} required.`,
      });
    }

    const discountAmount =
      coupon.discountType === "percentage"
        ? (subtotal * Number(coupon.discountValue)) / 100
        : Math.min(Number(coupon.discountValue), subtotal);

    return Response.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        discountAmount: Number(discountAmount.toFixed(2)),
        isSellerPromotion: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
