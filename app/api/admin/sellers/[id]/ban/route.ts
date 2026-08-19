import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { requestSellerBan } from "@/lib/sellers/admin-seller.service";
import { banSellerSchema } from "@/lib/validation/seller-enforcement";
import { AppError, errorResponse } from "@/lib/errors";

// POST /api/admin/sellers/[id]/ban
//
// PHASE 11 HARDENING: this no longer bans the seller immediately. It now
// creates a SellerBanRequest (status: pending) — the actual ban only
// executes once a DIFFERENT admin confirms it via
// POST /api/admin/sellers/[id]/ban-request/confirm. Kept at the same URL
// so nothing else needs to change to call it; only the behavior changed.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = banSellerSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);
    }

    const request = await requestSellerBan({
      sellerId: params.id,
      adminUserId: session.userId,
      reason: parsed.data.reason,
    });

    return Response.json({
      request,
      message:
        "Ban requested. A different admin must confirm it before it takes effect — the seller has not been banned yet.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
