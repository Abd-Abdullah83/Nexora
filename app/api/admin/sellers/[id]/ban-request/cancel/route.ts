import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { cancelBanRequest } from "@/lib/sellers/admin-seller.service";
import { cancelBanRequestSchema } from "@/lib/validation/seller-ban-request";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/sellers/[id]/ban-request/cancel
//
// Either admin can cancel a pending request — no two-admin requirement
// here, since standing down is the safe direction (nothing irreversible
// happens). Both the requesting admin changing their mind and the
// second admin declining to confirm should be able to close this out.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    cancelBanRequestSchema.safeParse(body); // note is optional, parse failures are non-fatal here

    const result = await cancelBanRequest({
      sellerId: params.id,
      adminUserId: session.userId,
    });

    return Response.json({ ...result, message: "Ban request cancelled. No action was taken against the seller." });
  } catch (error) {
    return errorResponse(error);
  }
}
