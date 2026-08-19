import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { duplicateProduct } from "@/lib/repositories/product.repository";
import { getClientIp } from "@/lib/security/rate-limit";
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

    const duplicate = await duplicateProduct(params.id);
    if (!duplicate) {
      throw new AppError("PRODUCT_NOT_FOUND");
    }

    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "product.duplicate",
      resourceType: "product",
      resourceId: duplicate.id,
      newValues: { duplicatedFrom: params.id },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ product: duplicate }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
