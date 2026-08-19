import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/db/redis";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";
import { getEffectivePrice } from "@/lib/utils/pricing";
import { z } from "zod";

// ─── Input schemas ────────────────────────────────────────────────────────────
const addSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

const patchSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

const deleteSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().nullable().optional(),
  clearAll: z.boolean().optional(),
});

// ─── Redis cart cache ─────────────────────────────────────────────────────────
// 60-second TTL — fast repeat reads, auto-invalidated on any mutation.

function cartCacheKey(userId: string) {
  return `cache:cart:${userId}`;
}

async function readCartCache(userId: string) {
  try {
    const raw = await redis.get(cartCacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeCartCache(userId: string, items: CartItemShape[]) {
  try {
    await redis.set(cartCacheKey(userId), JSON.stringify(items), "EX", 60);
  } catch {
    /* non-fatal */
  }
}

async function invalidateCartCache(userId: string) {
  try {
    await redis.del(cartCacheKey(userId));
  } catch {
    /* non-fatal */
  }
}

// ─── Shape returned to the client ────────────────────────────────────────────

interface CartItemShape {
  id: string;
  productId: string;
  variantId: string | null;
  variantName: string | null;
  variantAttributes: Record<string, string | number> | null;
  name: string;
  slug: string;
  price: number; // effective price (sale price if active, else base)
  originalPrice: number; // always base price, for strikethrough
  discountPercent: number | null;
  onSale: boolean;
  saleEndsAt: string | null;
  currency: string;
  imageUrl: string | null;
  quantity: number;
  stockQty: number;
  weightGrams: number | null;
  unavailable: boolean;
}

async function fetchCartItems(userId: string): Promise<CartItemShape[]> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          comparePrice: true,
          salePrice: true,
          saleEndsAt: true,
          currency: true,
          stockQty: true,
          status: true,
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          price: true,
          stockQty: true,
          weightGrams: true,
          attributeValues: true,
          isActive: true,
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  return rows.map((row) => {
    // A variant's own price overrides the product price entirely when set;
    // sale pricing only ever applies at the product level (no per-variant sales).
    const basePrice = row.variant?.price
      ? Number(row.variant.price)
      : Number(row.product.price);

    const pricing = getEffectivePrice({
      price: basePrice,
      comparePrice: row.product.comparePrice
        ? Number(row.product.comparePrice)
        : null,
      salePrice: row.product.salePrice ? Number(row.product.salePrice) : null,
      saleEndsAt: row.product.saleEndsAt,
    });

    const stockQty = row.variant ? row.variant.stockQty : row.product.stockQty;
    const weightGrams = row.variant?.weightGrams ?? null;

    return {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      variantName: row.variant?.name ?? null,
      variantAttributes:
        (row.variant?.attributeValues as Record<string, string | number>) ??
        null,
      name: row.product.name,
      slug: row.product.slug,
      price: pricing.effectivePrice,
      originalPrice: pricing.originalPrice,
      discountPercent: pricing.discountPercent,
      onSale: pricing.onSale,
      saleEndsAt: pricing.saleEndsAt ? pricing.saleEndsAt.toISOString() : null,
      currency: row.product.currency || "PKR",
      imageUrl: row.product.images[0]?.url ?? null,
      quantity: row.quantity,
      stockQty,
      weightGrams,
      unavailable:
        row.product.status !== "active" ||
        stockQty === 0 ||
        (row.variant !== null && !row.variant.isActive),
    };
  });
}

// ─── GET /api/cart ────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      // Return empty cart for unauthenticated users — not an error
      return Response.json({ items: [] }, { status: 401 });
    }

    const cached = await readCartCache(session.userId);
    if (cached) return Response.json({ items: cached });

    const items = await fetchCartItems(session.userId);
    await writeCartCache(session.userId, items);
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

// ─── POST /api/cart — add item (or add to existing quantity) ──────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAuth();
    if (!session) {
      return Response.json(
        { error: { message: "Please log in to add items to your cart." } },
        { status: 401 },
      );
    }

    const { allowed } = await rateLimit(`cart:${ip}`, 30, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success)
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { productId, quantity } = parsed.data;
    const variantId = parsed.data.variantId ?? null;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product || product.status !== "active") {
      throw new AppError("PRODUCT_NOT_FOUND");
    }

    // Stock is checked against the variant if one is selected, otherwise
    // against the product itself.
    let availableStock: number;
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, stockQty: true, isActive: true },
      });
      if (!variant || variant.productId !== productId || !variant.isActive) {
        throw new AppError("VALIDATION_ERROR", {
          variantId: "Invalid variant for this product.",
        });
      }
      availableStock = variant.stockQty;
    } else {
      const baseProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { stockQty: true },
      });
      availableStock = baseProduct?.stockQty ?? 0;
    }

    if (availableStock === 0) {
      throw new AppError("PRODUCT_OUT_OF_STOCK");
    }

    const existing = await prisma.cartItem.findFirst({
      where: { userId: session.userId, productId, variantId },
      select: { id: true, quantity: true },
    });
    const currentQty = existing?.quantity ?? 0;
    const newQty = currentQty + quantity;

    if (newQty > availableStock) {
      throw new AppError("CART_ITEM_EXCEEDS_STOCK");
    }

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: { userId: session.userId, productId, quantity, variantId },
      });
    }

    await invalidateCartCache(session.userId);
    const items = await fetchCartItems(session.userId);
    await writeCartCache(session.userId, items);
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

// ─── PATCH /api/cart — set exact quantity (qty stepper in drawer) ─────────────

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAuth();
    if (!session) {
      return Response.json(
        { error: { message: "Please log in." } },
        { status: 401 },
      );
    }

    const { allowed } = await rateLimit(`cart:${ip}`, 30, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success)
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const { productId, quantity } = parsed.data;
    const variantId = parsed.data.variantId ?? null;

    let availableStock: number;
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { stockQty: true, isActive: true },
      });
      if (!variant || !variant.isActive)
        throw new AppError("VALIDATION_ERROR", {
          variantId: "Invalid variant.",
        });
      availableStock = variant.stockQty;
    } else {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { stockQty: true, status: true },
      });
      if (!product || product.status !== "active")
        throw new AppError("PRODUCT_NOT_FOUND");
      availableStock = product.stockQty;
    }

    if (quantity > availableStock)
      throw new AppError("CART_ITEM_EXCEEDS_STOCK");

    const existing = await prisma.cartItem.findFirst({
      where: { userId: session.userId, productId, variantId },
      select: { id: true },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: { userId: session.userId, productId, quantity, variantId },
      });
    }

    await invalidateCartCache(session.userId);
    const items = await fetchCartItems(session.userId);
    await writeCartCache(session.userId, items);
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

// ─── DELETE /api/cart — remove one item or clear all ─────────────────────────

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const session = await requireAuth();
    if (!session) {
      return Response.json(
        { error: { message: "Please log in." } },
        { status: 401 },
      );
    }

    const { allowed } = await rateLimit(`cart:${ip}`, 30, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success)
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    if (parsed.data.clearAll) {
      // userId always from session — never the request body
      await prisma.cartItem.deleteMany({ where: { userId: session.userId } });
      await invalidateCartCache(session.userId);
      return Response.json({ items: [] });
    }

    if (parsed.data.productId) {
      await prisma.cartItem
        .deleteMany({
          where: {
            userId: session.userId,
            productId: parsed.data.productId,
            variantId: parsed.data.variantId ?? null,
          },
        })
        .catch(() => { }); // Silently succeed if row already gone
    }

    await invalidateCartCache(session.userId);
    const items = await fetchCartItems(session.userId);
    await writeCartCache(session.userId, items);
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
