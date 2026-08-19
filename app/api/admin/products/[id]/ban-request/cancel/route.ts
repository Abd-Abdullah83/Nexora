import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { cancelProductBanRequest } from "@/lib/admin/product-enforcement.service";
import { cancelProductBanRequestSchema } from "@/lib/validation/product-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/products/[id]/ban-request/cancel
// Either admin can stand down a pending request — no two-admin
// requirement here, since cancelling is always the safe direction.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    cancelProductBanRequestSchema.safeParse(body); // note is optional

    const result = await cancelProductBanRequest({
      productId: params.id,
      adminUserId: session.userId,
    });

    return Response.json({ ...result, message: "Ban request cancelled. No action was taken against the listing." });
  } catch (error) {
    return errorResponse(error);
  }
}
