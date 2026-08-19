import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { suspendProduct } from "@/lib/admin/product-enforcement.service";
import { suspendProductSchema } from "@/lib/validation/product-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/products/[id]/suspend
// Single admin, unilateral, reversible.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = suspendProductSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const result = await suspendProduct({
      productId: params.id,
      adminUserId: session.userId,
      reason: parsed.data.reason,
    });

    return Response.json({ ...result, message: "Listing suspended. The seller has been notified with the reason." });
  } catch (error) {
    return errorResponse(error);
  }
}
