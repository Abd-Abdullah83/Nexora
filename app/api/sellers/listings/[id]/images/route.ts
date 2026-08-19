// app/api/sellers/listings/[id]/images/route.ts
//
// BUG FIX: "Image can't be uploaded"
//
// ROOT CAUSE: uploadProductImage() in lib/storage/cloudinary.ts returns
//   { url: string, publicId: string }
// but this route read:
//   result.secure_url   ← doesn't exist, always undefined
//   result.public_id    ← doesn't exist, always undefined
//
// ProductImage.url is a required (non-nullable) column, so passing
// url: undefined to prisma.productImage.create() throws a Prisma
// validation error on every single upload attempt. This is why the
// upload always failed — 100% reproducible, not intermittent.
//
// SECOND BUG (same call): uploadProductImage(buffer, file.name) was
// passing the file name as the second argument, but that parameter is
// `folder` (the Cloudinary folder path), not a filename. This silently
// created a new Cloudinary folder per unique filename instead of using
// the intended "products" folder. Fixed to omit the second argument and
// use the function's default.
//
// Both fixed below. No other logic in this route changed.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { validateImageFile, uploadProductImage } from "@/lib/storage/cloudinary";
import { getListingForSeller } from "@/lib/sellers/listings.service";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "Seller account not found." });
  if (seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { allowed } = await rateLimit(`seller:listings:images:${session.userId}`, 30, 60);
    if (!allowed) throw new AppError("RATE_LIMIT_EXCEEDED");

    const seller = await getActiveSeller(session.userId);

    // Ownership check before touching Cloudinary — throws if not owned
    await getListingForSeller(params.id, seller.id);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const isPrimary = formData.get("isPrimary") === "true";

    if (!file) {
      throw new AppError("VALIDATION_ERROR", { file: "No file provided." });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic byte validation — same as admin image upload
    const validation = validateImageFile(buffer, file.type);
    if (validation) {
      throw new AppError(validation.code);
    }

    // FIX: removed the erroneous file.name second argument — that param
    // is the Cloudinary folder, not a filename. Uses default "products".
    const result = await uploadProductImage(buffer);

    // If this is the first image or marked primary, update all existing
    // images for this product to isPrimary=false first
    if (isPrimary) {
      await prisma.productImage.updateMany({
        where: { productId: params.id },
        data: { isPrimary: false },
      });
    }

    // Get current max displayOrder
    const maxOrder = await prisma.productImage.findFirst({
      where: { productId: params.id },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    const image = await prisma.productImage.create({
      data: {
        productId: params.id,
        // FIX: uploadProductImage() returns { url, publicId } — not
        // { secure_url, public_id }. Both fields below were previously
        // reading the wrong (nonexistent) keys and evaluating to undefined.
        url: result.url,
        storageKey: result.publicId,
        altText: file.name.replace(/\.[^/.]+$/, ""),
        isPrimary: isPrimary || (maxOrder === null), // first image is always primary
        displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
      },
    });

    return Response.json({ image }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const seller = await getActiveSeller(session.userId);
    // Ownership check
    await getListingForSeller(params.id, seller.id);

    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");
    if (!imageId) throw new AppError("VALIDATION_ERROR", { imageId: "imageId is required." });

    // Confirm the image actually belongs to this product before deleting
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: params.id },
    });
    if (!image) throw new AppError("VALIDATION_ERROR", { imageId: "Image not found." });

    await prisma.productImage.delete({ where: { id: imageId } });

    return Response.json({ message: "Image deleted." });
  } catch (error) {
    return errorResponse(error);
  }
}
