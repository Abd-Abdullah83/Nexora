import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { uploadProductImage, deleteProductImage } from "@/lib/storage/upload";
import { AppError, errorResponse } from "@/lib/errors";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ── POST /api/admin/upload ────────────────────────────────────────────────
// Accepts multipart/form-data with fields:
//   file       — the image file
//   productId  — which product to attach it to
//   isPrimary  — "true" | "false" (optional, defaults false)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      throw new AppError("ADMIN_UNAUTHORISED");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;
    const isPrimary = formData.get("isPrimary") === "true";

    if (!file) {
      throw new AppError("VALIDATION_ERROR", { file: "No file provided." });
    }
    if (!productId) {
      throw new AppError("VALIDATION_ERROR", { productId: "Product ID is required." });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError("VALIDATION_ERROR", {
        file: "Only JPEG, PNG, WebP, and GIF files are allowed.",
      });
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new AppError("VALIDATION_ERROR", { file: "Image must be under 8 MB." });
    }

    // Make sure the product actually exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError("PRODUCT_NOT_FOUND");

    // Convert browser File to Node Buffer for Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary — returns public URL + publicId for later deletion
    const result = await uploadProductImage(buffer);

    // If caller wants this image to be primary, demote existing primary first
    if (isPrimary) {
      await prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Put this image after any existing ones
    const lastImage = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { displayOrder: "desc" },
    });
    const displayOrder = lastImage ? lastImage.displayOrder + 1 : 0;

    // Save image record to database
    const image = await prisma.productImage.create({
      data: {
        productId,
        url: result.url,
        storageKey: result.publicId, // saved so we can delete from Cloudinary later
        altText: product.name,
        displayOrder,
        isPrimary: isPrimary || displayOrder === 0, // first upload is always primary
      },
    });

    return Response.json(
      { image, thumbUrl: result.thumbUrl },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// ── DELETE /api/admin/upload?imageId=xxx ─────────────────────────────────
// Deletes an image from both Cloudinary and the database.
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      throw new AppError("ADMIN_UNAUTHORISED");
    }

    const imageId = req.nextUrl.searchParams.get("imageId");
    if (!imageId) {
      throw new AppError("VALIDATION_ERROR", { imageId: "Image ID is required." });
    }

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
      throw new AppError("VALIDATION_ERROR", { imageId: "Image not found." });
    }

    // Delete from Cloudinary using stored publicId
    try {
      if (image.storageKey) {
        await deleteProductImage(image.storageKey);
      }
    } catch {
      // Log but don't crash — image may have already been deleted from Cloudinary
      console.warn(`[upload] Could not delete from Cloudinary: ${image.storageKey}`);
    }

    // Delete from database
    await prisma.productImage.delete({ where: { id: imageId } });

    // If the deleted image was the primary one, promote the next image
    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({
        where: { productId: image.productId },
        orderBy: { displayOrder: "asc" },
      });
      if (next) {
        await prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
