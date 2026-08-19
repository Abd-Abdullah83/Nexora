import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { deleteVariant } from "@/lib/repositories/variant.repository";
import { invalidateCache, CacheKeys } from "@/lib/cache/product-cache";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

interface RouteParams {
  params: { id: string; variantId: string };
}

// DELETE /api/admin/products/[id]/variants/[variantId]
// Soft-deletes (isActive: false) — preserves any order history referencing it.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    await deleteVariant(params.variantId);
    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "variant.delete",
      resourceType: "product",
      resourceId: params.id,
      oldValues: { variantId: params.variantId },
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ message: "Variant removed." });
  } catch (error) {
    return errorResponse(error);
  }
}
