import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { reinstateProduct } from "@/lib/admin/product-enforcement.service";
import { reinstateProductSchema } from "@/lib/validation/product-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/products/[id]/reinstate
// Lifts a suspension only — banned listings aren't reinstated this way.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = reinstateProductSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const result = await reinstateProduct({
      productId: params.id,
      adminUserId: session.userId,
      reason: parsed.data.reason,
    });

    return Response.json({ ...result, message: "Listing reinstated and live again." });
  } catch (error) {
    return errorResponse(error);
  }
}
