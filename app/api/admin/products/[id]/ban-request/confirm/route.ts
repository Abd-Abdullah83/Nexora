import { requireAdmin } from "@/lib/auth/rbac";
import { confirmProductBan } from "@/lib/admin/product-enforcement.service";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/products/[id]/ban-request/confirm
//
// Must be called by a DIFFERENT admin than the one who requested the
// ban — confirmProductBan() enforces this against the real session.

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const result = await confirmProductBan({
      productId: params.id,
      confirmingAdminUserId: session.userId,
    });

    return Response.json({
      ...result,
      message: "Ban confirmed and executed. The seller has been notified with the reason.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
