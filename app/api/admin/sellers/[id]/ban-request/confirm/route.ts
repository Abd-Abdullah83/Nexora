import { requireAdmin } from "@/lib/auth/rbac";
import { confirmSellerBan } from "@/lib/sellers/admin-seller.service";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/sellers/[id]/ban-request/confirm
//
// Must be called by a DIFFERENT admin than the one who requested the
// ban — confirmSellerBan() enforces this against the real session,
// not anything the client sends.

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const result = await confirmSellerBan({
      sellerId: params.id,
      confirmingAdminUserId: session.userId,
    });

    return Response.json({
      ...result,
      message: "Ban confirmed and executed. Listings archived, payouts cancelled, escrow frozen.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
