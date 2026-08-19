import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  getVariantsByProduct,
  createVariant,
} from "@/lib/repositories/variant.repository";
import { createVariantSchema } from "@/lib/validation/variant";
import { invalidateCache, CacheKeys } from "@/lib/cache/product-cache";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { AppError, errorResponse } from "@/lib/errors";

interface RouteParams {
  params: { id: string }; // productId
}

// GET /api/admin/products/[id]/variants
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const variants = await getVariantsByProduct(params.id);
    return Response.json({ variants });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/admin/products/[id]/variants
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req.headers);

  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json();
    const parsed = createVariantSchema.safeParse({
      ...body,
      productId: params.id,
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten());
    }

    // createVariant() validates attributeValues against the category's
    // CategoryAttribute rows internally — see variant.repository.ts.
    const variant = await createVariant(parsed.data);

    await invalidateCache(CacheKeys.productsAll);

    await logAuditEvent({
      userId: session.userId,
      action: "variant.create",
      resourceType: "product",
      resourceId: params.id,
      newValues: variant,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return Response.json({ variant }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
