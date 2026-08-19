import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

// ── GET /api/wishlist ─────────────────────────────────────────────────────
// Returns all wishlist product IDs for the current user.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return Response.json({ items: [] });

    const items = await prisma.wishlist.findMany({
      where: { userId: session.userId },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            price: true,
            comparePrice: true,
            salePrice: true,
            saleEndsAt: true,
            currency: true,
            stockQty: true,
            images: {
              where: { isPrimary: true },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── POST /api/wishlist ────────────────────────────────────────────────────
// Body: { productId }
// Adds a product to wishlist. Idempotent — adding twice is fine.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { productId } = await req.json();
    if (!productId) throw new AppError("VALIDATION_ERROR", { productId: "Required." });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError("PRODUCT_NOT_FOUND");

    // upsert so hitting the heart twice doesn't crash
    await prisma.wishlist.upsert({
      where: { userId_productId: { userId: session.userId, productId } },
      create: { userId: session.userId, productId },
      update: {},
    });

    return Response.json({ wishlisted: true });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── DELETE /api/wishlist ──────────────────────────────────────────────────
// Body: { productId }
// Removes a product from wishlist.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { productId } = await req.json();
    if (!productId) throw new AppError("VALIDATION_ERROR", { productId: "Required." });

    await prisma.wishlist.deleteMany({
      where: { userId: session.userId, productId },
    });

    return Response.json({ wishlisted: false });
  } catch (error) {
    return errorResponse(error);
  }
}
