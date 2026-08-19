import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { validateImageFile, uploadProductImage } from "@/lib/storage/cloudinary";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { invalidateCache, CacheKeys } from "@/lib/cache/product-cache";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) {
      throw new AppError("ADMIN_UNAUTHORISED");
    }

    // Upload-specific rate limit, tighter than general admin mutations,
    // per the project security plan (10 uploads/minute/user).
    const { allowed, retryAfterSeconds } = await rateLimit(
      `admin-image-upload:${session.userId}`,
      10,
      60
    );
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
    }

    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) {
      throw new AppError("PRODUCT_NOT_FOUND");
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", { file: "No file provided." });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validationError = validateImageFile(buffer, file.type);
    if (validationError) {
      throw new AppError(validationError.code);
    }

    const { url, publicId } = await uploadProductImage(buffer);

    const existingImageCount = await prisma.productImage.count({
      where: { productId: params.id },
    });

    const image = await prisma.productImage.create({
      data: {
        productId: params.id,
        url,
        altText: product.name,
        displayOrder: existingImageCount,
        isPrimary: existingImageCount === 0,
      },
    });

    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "product.image_upload",
      resourceType: "product",
      resourceId: params.id,
      newValues: { imageId: image.id, publicId },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ image }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
