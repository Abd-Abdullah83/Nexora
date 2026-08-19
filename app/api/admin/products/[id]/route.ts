// app/api/admin/products/[id]/route.ts
//
// BUG 1 FIX: Admin could edit any product including seller-owned listings.
//
// The rule:
//   - Admin CAN edit products where sellerId is null (pre-marketplace
//     platform products) OR where the product belongs to the system seller
//     (isSystemSeller = true). These are Nexora's own catalog.
//   - Admin CANNOT edit content of seller-owned listings. They can only
//     use enforcement actions (ban, archive via override) — not PUT content.
//   - Admin CAN still GET and DELETE any product (for moderation/removal).
//
// The check is in the PUT handler only — GET and DELETE are unchanged.
// A blocked PUT returns 403 with a clear message so the admin UI can
// show the right message rather than a generic error.

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  getProductById,
  updateProduct,
  softDeleteProduct,
  slugExists,
  skuExists,
} from "@/lib/repositories/product.repository";
import { updateProductSchema } from "@/lib/validation/product";
import { generateUniqueSlug } from "@/lib/utils/slug";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { invalidateCache, CacheKeys } from "@/lib/cache/product-cache";
import { AppError, errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";

// ── Helper: is this product editable by admin? ────────────────────────────
//
// Returns true if the product is platform-owned (no seller, or the system
// seller). Returns false if it belongs to a real independent seller.
async function isAdminEditableProduct(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      sellerId: true,
      seller: { select: { isSystemSeller: true } },
    },
  });

  if (!product) return false; // will 404 upstream anyway

  // No seller at all — old pre-marketplace product, admin owns it
  if (!product.sellerId) return true;

  // System seller — Nexora's own catalog anchor
  if (product.seller?.isSystemSeller) return true;

  // Real independent seller — admin must NOT edit content
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const product = await getProductById(params.id);
    if (!product) throw new AppError("PRODUCT_NOT_FOUND");

    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const { allowed, retryAfterSeconds } = await rateLimit(
      `admin-product-update:${session.userId}`,
      60,
      60
    );
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });

    const existing = await getProductById(params.id);
    if (!existing) throw new AppError("PRODUCT_NOT_FOUND");

    // BUG 1 FIX: Block admin from editing seller-owned product content.
    // Admins use enforcement routes (ban, archive override) for seller
    // listings — not direct content edits.
    const editable = await isAdminEditableProduct(params.id);
    if (!editable) {
      return Response.json(
        {
          error: {
            code: "ADMIN_UNAUTHORISED",
            message:
              "This listing belongs to an independent seller and cannot be edited by admin. " +
              "Use enforcement actions (archive override, seller ban) instead.",
          },
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    const data = parsed.data;

    // Validate sale price is positive and less than base price
    const basePrice = data.price ?? Number(existing.price);
    if (data.salePrice !== undefined && data.salePrice !== null) {
      if (data.salePrice <= 0) {
        throw new AppError("VALIDATION_ERROR", { salePrice: "Sale price must be positive." });
      }
      if (data.salePrice >= basePrice) {
        throw new AppError("VALIDATION_ERROR", {
          salePrice: "Sale price must be less than the base price.",
        });
      }
    }

    if (data.sku && data.sku !== existing.sku && (await skuExists(data.sku))) {
      throw new AppError("VALIDATION_ERROR", { sku: "This SKU is already in use." });
    }

    let slug: string | undefined;
    if (data.name && data.name !== existing.name) {
      slug = await generateUniqueSlug(data.name, async (candidate) => {
        if (candidate === existing.slug) return false;
        return slugExists(candidate);
      });
    }

    const updated = await updateProduct(params.id, {
      ...(data.name ? { name: data.name } : {}),
      ...(slug ? { slug } : {}),
      ...(data.description ? { description: data.description } : {}),
      ...(data.shortDescription !== undefined
        ? { shortDescription: data.shortDescription }
        : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.comparePrice !== undefined
        ? { comparePrice: data.comparePrice ?? null }
        : {}),
      ...(data.costPrice !== undefined ? { costPrice: data.costPrice ?? null } : {}),
      ...(data.salePrice !== undefined ? { salePrice: data.salePrice ?? null } : {}),
      ...(data.saleEndsAt !== undefined
        ? { saleEndsAt: data.saleEndsAt ? new Date(data.saleEndsAt) : null }
        : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl ?? null } : {}),
      ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
      ...(data.sku ? { sku: data.sku } : {}),
      ...(data.stockQty !== undefined ? { stockQty: data.stockQty } : {}),
      ...(data.lowStockThreshold !== undefined
        ? { lowStockThreshold: data.lowStockThreshold }
        : {}),
      ...(data.weightGrams !== undefined ? { weightGrams: data.weightGrams ?? null } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      ...(data.isBestSeller !== undefined ? { isBestSeller: data.isBestSeller } : {}),
      ...(data.isNewArrival !== undefined ? { isNewArrival: data.isNewArrival } : {}),
      ...(data.tags ? { tags: data.tags } : {}),
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined
        ? { metaDescription: data.metaDescription }
        : {}),
    });

    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "product.update",
      resourceType: "product",
      resourceId: params.id,
      oldValues: existing,
      newValues: updated,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ product: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const existing = await getProductById(params.id);
    if (!existing) throw new AppError("PRODUCT_NOT_FOUND");

    const deleted = await softDeleteProduct(params.id);

    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "product.delete",
      resourceType: "product",
      resourceId: params.id,
      oldValues: existing,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ product: deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
